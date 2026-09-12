import { join } from 'path';
import fs from 'fs/promises';
import log from 'electron-log/main';
import { shell } from 'electron';
import QRCode from 'qrcode';

import type { PreviewOptions } from '/shared/types/settings';
import { PREVIEW_CLIENT } from '/shared/types/settings';
import { PREVIEW_PROGRESS_EVENT, type PreviewProgress } from '/shared/types/ipc';
import {
  ClientError,
  CLIENT_NOT_INSTALLED_ERROR,
  isClientNotInstalledError,
} from '/shared/types/client';
import type { DeployOptions } from '/shared/types/deploy';
import { dynamicImport } from '/shared/dynamic-import';

import { MAIN_WINDOW_ID } from '../mainWindow';
import { dclDeepLink, run, type Child } from './bin';
import { getBundledNodePath } from './path';
import { getAvailablePort } from './port';
import { getWindow } from './window';
import { getProjectId, track } from './analytics';
import { install } from './npm';
import { downloadGithubRepo } from './download-github-folder';
import { startMobileDebugServer } from './mobile-debug-server';
import { getLanIp } from './network';

// `mobile` marks a preview that was started for the mobile-QR flow (`--mobile`): the
// SDK runs the preview server but does NOT open the desktop client. It is tracked so a
// later desktop Preview press restarts instead of reusing it (a reused mobile preview
// would never open the client the user just asked for).
export type Preview = { child: Child; url: string; opts: PreviewOptions; mobile: boolean };

// Explorer deeplink param for locally generated asset bundles. sdk-commands owns the
// abgen sidecar (--asset-bundles) and injects local-ab into the deeplink it fires only
// when the sidecar actually booted — its presence in the captured deeplink is the
// source of truth for whether the running preview has one.
const LOCAL_AB_PARAM = 'local-ab';

// Grace window for the mobile-QR deeplink to appear after the preview server reports
// ready. sdk-commands prints it only with a LAN IP; if none is found it never comes, so
// the mobile start settles (with no url) shortly after instead of hanging indefinitely.
const MOBILE_DEEPLINK_GRACE_MS = 5000;

// A large scene's first conversion can take minutes before the deeplink appears; the
// sidecar's progress lines are streamed to the renderer so the preview button can say
// why it is still loading.
function sendPreviewProgress(path: string, progress: PreviewProgress | null) {
  const window = getWindow(MAIN_WINDOW_ID);
  if (window && !window.isDestroyed()) {
    window.webContents.send(PREVIEW_PROGRESS_EVENT, { path, progress });
  }
}

const previewCache: Map<string, Preview> = new Map();
export let deployServer: { stop: () => Promise<void> } | null = null;

export function getPreview(path: string) {
  return previewCache.get(path);
}

async function getEnv(path: string) {
  const projectId = await getProjectId(path);
  return {
    ANALYTICS_PROJECT_ID: projectId,
    ANALYTICS_APP_ID: 'creator-hub',
  };
}

export async function init(targetPath: string, repo: string): Promise<void> {
  if (!repo) {
    throw new Error('Repository URL is required');
  }

  // Extract owner and repo name from the GitHub URL
  const isGithubRepo = repo.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!isGithubRepo) {
    throw new Error('Invalid GitHub repository URL');
  }
  log.info('[CLI] Downloading GitHub repository', { repo, targetPath });
  await downloadGithubRepo(repo, targetPath);
  log.info('[CLI] GitHub repository downloaded successfully');
  track('Scene created', {
    projectType: 'github-repo',
    url: repo,
    project_id: await getProjectId(targetPath),
  });
}

export async function killPreview(path: string) {
  const preview = previewCache.get(path);
  const promise = preview?.child.kill().catch(() => {});
  previewCache.delete(path);
  await promise;
}

export async function killAllPreviews() {
  for (const path of previewCache.keys()) {
    await killPreview(path);
  }
  previewCache.clear(); // just to be sure...
}

// `client` selects the launch path (Unity vs Bevy) in `start()`, not a CLI flag;
// `optimizedAssets` maps to the spawn-time `--asset-bundles` sidecar flag handled in
// `doStart()`; `debugger`/`showWarnings` are renderer-only. Everything left maps to a flag.
type PreviewArguments = Omit<
  PreviewOptions,
  'debugger' | 'showWarnings' | 'optimizedAssets' | 'client' | 'customClientUrl'
>;

const PREVIEW_OPTIONS_MAP: Record<keyof PreviewArguments, string> = {
  enableLandscapeTerrains: '--landscape-terrain-enabled',
  openNewInstance: '-n',
  skipAuthScreen: '--skip-auth-screen',
  multiInstance: '--multi-instance',
  mcp: '--mcp',
};

function generatePreviewArguments(opts: PreviewOptions) {
  // Multi-instance preview requires authentication to differentiate players
  const resolved = { ...opts, skipAuthScreen: !opts.multiInstance };
  const args: string[] = [];
  for (const key in resolved) {
    const typedKey = key as keyof PreviewArguments;
    if (resolved[typedKey] && typedKey in PREVIEW_OPTIONS_MAP) {
      args.push(PREVIEW_OPTIONS_MAP[typedKey]);
    }
  }
  return args;
}

function isPreviewRunning(preview?: Preview): preview is Preview {
  return !!(preview?.child.alive() && preview.url);
}

async function sceneHasLandscapeTerrain(path: string): Promise<boolean> {
  try {
    const sceneJson = JSON.parse(await fs.readFile(join(path, 'scene.json'), 'utf-8'));
    return sceneJson.landscapeTerrain !== false;
  } catch {
    return true;
  }
}

function getDeepLinkParam(raw: string, key: string): string | null {
  const queryIdx = raw.indexOf('?');
  if (queryIdx < 0) return null;
  return new URLSearchParams(raw.slice(queryIdx + 1)).get(key);
}

function getPreviewServerUrl(deepLinkUrl: string): string | null {
  try {
    // The desktop-client deeplink carries the server as `realm=<origin>`; the mobile
    // deeplink (`open?preview=<lanUrl>&...`, from a `--mobile` start) carries it as
    // `preview=<lanUrl>`. Slice off any leading path (e.g. `open?`) before parsing.
    const queryIdx = deepLinkUrl.indexOf('?');
    const query = queryIdx >= 0 ? deepLinkUrl.slice(queryIdx + 1) : deepLinkUrl;
    const params = new URLSearchParams(query);
    const server = params.get('realm') ?? params.get('preview');
    if (server) {
      const url = new URL(server);
      return `${url.protocol}//${url.host}`;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getMobilePreview(path: string): Promise<{ url: string; qr: string } | null> {
  const preview = previewCache.get(path);
  if (!isPreviewRunning(preview)) {
    return null;
  }

  const serverUrl = getPreviewServerUrl(preview.url);
  if (!serverUrl) {
    log.warn('[CLI] Could not extract server URL from deep-link:', preview.url);
    return null;
  }

  try {
    const response = await fetch(`${serverUrl}/mobile-preview`);
    if (!response.ok) {
      log.warn('[CLI] Mobile preview endpoint returned error:', response.status);
      return null;
    }
    const json = await response.json();
    if (json.ok && json.data) {
      let { url, qr } = json.data as { url: string; qr: string };

      log.info(
        '[CLI] getMobilePreview: got URL from SDK, attempting mobile debug server setup...',
        {
          url: url.substring(0, 80),
          serverUrl,
        },
      );
      try {
        const wsPort = await startMobileDebugServer();
        // Extract the host from the mobile preview URL (not serverUrl which may be 127.0.0.1)
        // The mobile URL has the LAN IP that the phone can reach
        const mobilePreviewParam = getDeepLinkParam(url, 'preview');
        let previewHost = mobilePreviewParam
          ? new URL(mobilePreviewParam).hostname
          : new URL(serverUrl).hostname;
        if (previewHost === '127.0.0.1' || previewHost === 'localhost') {
          previewHost = getLanIp();
        }
        const sceneInspectorTarget = `ws://${previewHost}:${wsPort}`;

        // Append scene-inspector param to the mobile URL
        if (url.includes('?')) {
          url = `${url}&scene-inspector=${encodeURIComponent(sceneInspectorTarget)}`;
        } else {
          url = `${url}?scene-inspector=${encodeURIComponent(sceneInspectorTarget)}`;
        }

        // Regenerate QR with the modified URL
        qr = await QRCode.toDataURL(url, { width: 512, margin: 2 });

        log.info(`[mobile-debug] WS at ws://0.0.0.0:${wsPort}, mobile URL updated`);
      } catch (wsError: unknown) {
        if (wsError instanceof Error) {
          log.error('[CLI] Could not start mobile debug server:', wsError.message, wsError.stack);
        } else {
          log.error('[CLI] Could not start mobile debug server:', wsError);
        }
      }

      return { url, qr };
    }
    return null;
  } catch (error) {
    log.error('[CLI] Error fetching mobile preview:', error);
    return null;
  }
}

// This fn is for already created deep-link. Just to add or remove values to a generated deep-link
// decentraland://position=80,80&skip-auth-screen=true etc
function updateDeepLinkWithOpts(params: string, newOpts: PreviewOptions): string {
  try {
    const urlParams = new URLSearchParams(params);

    // for the deep-link we need to remove the starting `--`
    // decentraland://?skip-auth-screen=true
    const stripLeadingDashes = (option: string): string => {
      return option.replace(/^-+/, '');
    };

    const setOrDeleteParam = (key: string, value: any) => {
      if (value) {
        urlParams.set(stripLeadingDashes(key), typeof value === 'string' ? value : 'true');
      } else {
        urlParams.delete(stripLeadingDashes(key));
      }
    };

    // Multi-instance preview requires authentication to differentiate players
    setOrDeleteParam(PREVIEW_OPTIONS_MAP.skipAuthScreen, !newOpts.multiInstance);
    setOrDeleteParam(PREVIEW_OPTIONS_MAP.enableLandscapeTerrains, newOpts.enableLandscapeTerrains);
    setOrDeleteParam(PREVIEW_OPTIONS_MAP.multiInstance, newOpts.multiInstance);
    setOrDeleteParam(PREVIEW_OPTIONS_MAP.mcp, newOpts.mcp);

    // Locally generated asset bundles: local-ab is only valid when the captured deeplink
    // carried it, i.e. the preview was spawned with a sidecar. Setting it on a preview
    // spawned without one would point the explorer at optimized assets nothing is serving.
    const hasSidecar = urlParams.has(LOCAL_AB_PARAM);
    if (newOpts.optimizedAssets && !hasSidecar) {
      log.warn(
        '[CLI] Optimized assets requested but the preview was spawned without the sidecar; previewing with raw GLTFs',
      );
    }
    setOrDeleteParam(LOCAL_AB_PARAM, newOpts.optimizedAssets && hasSidecar);

    // this param is different from what we recieved from the CLI that the one that the launcher uses.
    setOrDeleteParam('open-deeplink-in-new-instance', newOpts.openNewInstance);
    const output = urlParams.toString();
    log.info(`[CLI] created deeplink with options: ${output}`);
    return output;
  } catch (e) {
    log.error(
      `[CLI] error occuring when adding additional arguments to deeplink, fallback to deeplink without params: ${e}`,
    );
    return params;
  }
}

// Feature-detect the opt-in sidecar flag in the scene's installed sdk-commands
// (same pattern as shouldRunLegacyDeploy). The quote-delimited match avoids false
// positives on the older opt-out flag --no-asset-bundles.
// Cached by the dist file's mtime: the multi-MB bundle would otherwise be re-read on
// every dropdown render and Preview press; an (re)install touches the file and busts it.
const assetBundlesSupportCache = new Map<string, { mtimeMs: number; supported: boolean }>();

export async function supportsAssetBundles(path: string): Promise<boolean> {
  const file = join(path, 'node_modules', '@dcl/sdk-commands/dist/commands/start/index.js');
  try {
    const { mtimeMs } = await fs.stat(file);
    const cached = assetBundlesSupportCache.get(file);
    if (cached?.mtimeMs === mtimeMs) return cached.supported;
    const content = await fs.readFile(file, 'utf-8');
    const supported = /["']--asset-bundles["']/.test(content);
    assetBundlesSupportCache.set(file, { mtimeMs, supported });
    return supported;
  } catch {
    return false;
  }
}

// `mcpPort` is transient (not a user PreviewOptions setting): the Explorer-gateway
// launches a preview with `mcp: true` and needs the Explorer's MCP server on a known
// port so it can connect an MCP client to it. sdk-commands accepts `--mcp-port` (≥7.25.0)
// and forwards it to the Explorer as a deeplink param; omitted, the Explorer defaults to
// 8123. Only honoured on the Unity (`--explorer-alpha`) path alongside `--mcp`.
type StartOptions = PreviewOptions & { retry?: boolean; mobile?: boolean; mcpPort?: number };

// Serializes concurrent starts per path: a second Preview press (or a mobile-QR start)
// while a spawn is still converting must ride that spawn, not race a second one.
const inflightStarts = new Map<string, Promise<string>>();

// Paths whose in-flight spawn the user cancelled (✕ while converting): start() must
// settle quietly for them — a deliberate cancel is not a failure to reinstall-and-retry.
const cancelledStarts = new Set<string>();

/**
 * Cancels a preview that is still converting (no deeplink yet, so the client never
 * opened): kills the spawn and lets the pending start() resolve quietly. No-op once
 * the preview has opened — there is nothing left to cancel.
 */
export async function cancelPreview(path: string): Promise<void> {
  const preview = previewCache.get(path);
  if (preview?.child.alive() && !preview.url) {
    log.info('[CLI] preview cancelled while converting');
    cancelledStarts.add(path);
    await killPreview(path);
  }
}

export async function start(path: string, opts: StartOptions): Promise<string> {
  // A start is already underway (still converting/booting): ride it instead of racing a
  // second one — the sdk self-opens the client when it's ready, so there is nothing to fire.
  const pending = inflightStarts.get(path);
  if (pending) {
    await pending.catch(() => {});
    return path;
  }

  // Registered synchronously — no await between the check above and this set — so
  // concurrent same-tick starts (a Preview press racing a mobile-QR start) ride this
  // entry instead of double-spawning a process previewCache would orphan. The entry
  // spans the whole operation, reinstall-retry included, so a start landing mid-retry
  // is serialized too.
  const entry = doStart(path, opts);
  inflightStarts.set(path, entry);
  try {
    return await entry;
  } finally {
    // guarded so a stale settle never clobbers an entry registered by a later start()
    if (inflightStarts.get(path) === entry) inflightStarts.delete(path);
  }
}

async function doStart(path: string, opts: StartOptions): Promise<string> {
  const { retry = true } = opts;

  // The scene-level landscapeTerrain opt-out overrides the preview preference
  if (!(await sceneHasLandscapeTerrain(path))) {
    opts = { ...opts, enableLandscapeTerrains: false };
  }

  const preview = previewCache.get(path);

  // If we have a preview running for this path, reuse it — but only if it's the
  // same client. Switching client (Unity <-> Bevy) means a different launch, so
  // tear the old one down and start fresh below. A mode switch (mobile QR <-> desktop
  // Preview) also can't be reused: a mobile-mode preview never opened the desktop client,
  // so a desktop Preview press must restart to actually launch it.
  if (
    isPreviewRunning(preview) &&
    preview.opts.client === opts.client &&
    preview.mobile === !!opts.mobile
  ) {
    if (opts.client === PREVIEW_CLIENT.BEVY_WEB) {
      // The Bevy web client runs in the browser; sdk-commands opened the tab on
      // launch and there's no deep-link to re-issue. Re-open the stored URL so a
      // second Preview click refocuses/reopens it. (`isPreviewRunning` already
      // guarantees a non-empty url.)
      await shell.openExternal(preview.url);
      return path;
    }
    if (opts.client === PREVIEW_CLIENT.CUSTOM) {
      await shell.openExternal(opts.customClientUrl ?? '');
      return path;
    }

    // Desktop (Unity): the sidecar lives and dies with the preview process
    // (--asset-bundles is a spawn-time flag), so whenever the Optimized Assets toggle
    // disagrees with the running preview — needs a sidecar it doesn't have, or carries
    // one it no longer should — restart the preview instead of reusing it.
    const previewHasSidecar = new URLSearchParams(preview.url).has(LOCAL_AB_PARAM);
    const wantsSidecar = opts.optimizedAssets && (await supportsAssetBundles(path));

    if (wantsSidecar === previewHasSidecar) {
      // re-focus the already-open client, with the deeplink adjusted to the current options
      await dclDeepLink(updateDeepLinkWithOpts(preview.url, opts));
      return path;
    }
  }

  killPreview(path);
  // a fresh spawn starts with a clean slate: a marker left by a cancel that raced the
  // deeplink must not swallow this spawn's real failures
  cancelledStarts.delete(path);

  let stopConversionProgress = () => {};

  const isCustomClient = opts.client === PREVIEW_CLIENT.CUSTOM;
  const isBevyWeb = opts.client === PREVIEW_CLIENT.BEVY_WEB || isCustomClient;
  // Mobile-QR start: `--mobile` makes sdk-commands serve the scene and print a capturable
  // mobile deeplink without opening the desktop client. Only meaningful on the Unity path
  // (the mobile app opens `decentraland://`); Bevy is web-only, so it keeps its own launch.
  const isMobile = !!opts.mobile && !isBevyWeb;

  try {
    const extraArgs: string[] = [];
    let withSidecar = false;

    // sdk-commands owns the asset-bundle sidecar: --asset-bundles boots it and injects
    // local-ab into the deeplink it fires. Missing binary or a sidecar that never comes
    // up degrades to raw GLTFs inside sdk-commands itself. The sidecar only applies to
    // the Unity deep-link path — Bevy web has no deeplink to carry local-ab.
    if (!isBevyWeb && opts.optimizedAssets) {
      if (await supportsAssetBundles(path)) {
        extraArgs.push('--asset-bundles');
        withSidecar = true;
      } else {
        log.warn(
          '[CLI] Installed @dcl/sdk-commands does not support --asset-bundles; previewing with raw GLTFs',
        );
      }
    }

    // Unity launches via a `decentraland://` deep-link; Bevy (`--bevy-web`) runs
    // the content server and opens the hosted web client in the browser itself,
    // so it emits no deep-link — we wait for the server-ready line instead.
    // On the Unity path, sdk-commands self-opens the client with the deeplink it prints
    // once the preview is ready; the capture below is only for the cache (re-focus,
    // option flips, mobile QR).
    const args = isBevyWeb
      ? [
          'start',
          '--bevy-web',
          ...(isCustomClient ? ['--no-browser'] : []),
          ...generatePreviewArguments(opts),
        ]
      : [
          'start',
          '--explorer-alpha',
          '--hub',
          ...(isMobile ? ['--mobile'] : []),
          ...extraArgs,
          ...generatePreviewArguments(opts),
          // `--mcp` (a boolean) is emitted by generatePreviewArguments from opts.mcp;
          // pin the port too when the gateway asked for one, so it knows where to connect.
          ...(opts.mcp && opts.mcpPort !== undefined ? ['--mcp-port', String(opts.mcpPort)] : []),
        ];

    // Preview runs on the bundled Node binary rather than an Electron utility process. The
    // multiplayer server sdk-commands spawns inherits this runtime, and its `isolated-vm`
    // dependency has no build for Electron's module ABI. Falls back to the utility process when
    // no real Node is around, which just leaves the multiplayer server unavailable as before.
    // TEMPORARY: remove with the Bevy migration.
    const process = run('@dcl/sdk-commands', 'sdk-commands', {
      args,
      cwd: path,
      workspace: path,
      env: await getEnv(path),
      nodePath: getBundledNodePath(),
    });

    // registered before the deeplink resolves so the spawn can be cancelled mid-conversion
    previewCache.set(path, { child: process, url: '', opts, mobile: isMobile });

    if (isBevyWeb) {
      // No deep-link on this path — sdk-commands prints this once the preview
      // server is up and has already opened the Bevy client in the browser.
      const serverReady = /Preview server is now running/i;
      await process.waitFor(serverReady, /CliError|error:/i);

      // Store the browser URL sdk-commands opened so a repeat Preview click can
      // reopen it (see the reuse fast-path above). Fall back to empty string if
      // the line isn't in the buffer; `isPreviewRunning` also checks `url`.
      const bevyUrl =
        process
          .stdall()
          .join('')
          .match(/https?:\/\/\S*bevy-web\S*/i)?.[0] ?? '';
      const entry = previewCache.get(path);
      if (entry?.child === process) {
        // Custom stores a truthy token so reuse can re-open the typed URL without
        // respawning. Official Bevy stores the printed browser URL.
        entry.url = isCustomClient ? opts.customClientUrl || 'custom' : bevyUrl;
      }
      if (isCustomClient) {
        await shell.openExternal(opts.customClientUrl ?? '');
      }
      return path;
    }

    // immediate feedback for an optimized preview: the first real progress line is many
    // seconds away (bundling + sidecar boot), and the ✕ only shows once progress exists
    if (withSidecar) sendPreviewProgress(path, { seconds: 0 });

    // \S* tolerates the ANSI reset between "[n/total]" and "converting": patterns are
    // tested against the raw stream, while the handler receives sanitized text.
    const conversionListener = process.on(
      /asset-bundles: (converting|still converting)|\[\d+\/\d+\]\S* converting /,
      data => {
        // per-asset counter when the sidecar reports progress, elapsed seconds otherwise
        const counts = data?.match(/\[(\d+)\/(\d+)\]\S* converting /);
        if (counts) {
          sendPreviewProgress(path, {
            seconds: 0,
            done: Number(counts[1]),
            total: Number(counts[2]),
          });
        } else {
          const seconds = Number(data?.match(/still converting\.\.\. \((\d+)s\)/)?.[1] ?? 0);
          sendPreviewProgress(path, { seconds });
        }
      },
    );
    stopConversionProgress = () => {
      try {
        process.off(conversionListener);
      } catch {
        // the process may already be gone; only the renderer reset matters
      }
      sendPreviewProgress(path, null);
    };

    const dclLauncherURL = /decentraland:\/\/([^\s\n]*)/i;
    const spawned = (async () => {
      // waitFor resolves/rejects via `once` matchers that cleanup() disables the instant the
      // process exits (a natural exit, or an explicit kill from cancelPreview). On its own it
      // would then hang forever if the process dies before printing a deeplink, leaving
      // inflightStarts[path] stuck and every later Preview press awaiting it. Race it against
      // process death so a cancelled/failed spawn rejects here and the finally below clears
      // inflightStarts. wait() stays pending while the preview server runs, so the deeplink
      // normally wins; it only settles once the process is gone.
      // Registered before any await so it can't miss a deeplink flushed early.
      const deeplink = process.waitFor(dclLauncherURL, /CliError|error:/i);
      const death = process.wait().then(() => {
        throw new Error('Preview process exited before producing a deeplink');
      });
      // On the mobile path the desktop client never opens, so the only deeplink is the LAN
      // QR one — which sdk-commands prints only when a LAN IP exists. Without one it never
      // comes, so add a fallback that settles a beat after the server is up (an empty url
      // getMobilePreview then surfaces as a failure) rather than hanging forever. A deeplink
      // that does arrive still wins this race first, even minutes into a large conversion.
      const racers = [deeplink, death];
      if (isMobile) {
        racers.push(
          process
            .waitFor(/Preview server is now running/i, /CliError|error:/i)
            .then(
              () => new Promise<string>(resolve => setTimeout(resolve, MOBILE_DEEPLINK_GRACE_MS)),
            )
            .then(() => ''),
        );
      }
      const resultLogs = await Promise.race(racers);

      // Check if the error indicates that Decentraland Desktop Client is not installed
      if (resultLogs.includes(CLIENT_NOT_INSTALLED_ERROR)) {
        throw new ClientError('CLIENT_NOT_INSTALLED', CLIENT_NOT_INSTALLED_ERROR);
      }

      const url = resultLogs.match(dclLauncherURL)?.[1] ?? '';
      const entry = previewCache.get(path);
      if (entry?.child === process) entry.url = url;
      return url;
    })();

    await spawned;
    // the sdk already opened the client with the deeplink it printed; nothing to fire here
    return path;
  } catch (error) {
    killPreview(path);
    // a deliberate ✕ lands here as a process-death rejection: settle quietly, no retry
    if (cancelledStarts.delete(path)) {
      log.info('[CLI] preview start cancelled by the user');
      return path;
    }
    if (retry && !isClientNotInstalledError(error)) {
      log.info('[CLI] Something went wrong trying to start preview:', (error as Error).message);
      await install(path);
      // recurse into doStart, not start(): the wrapper's inflight entry (this very call)
      // is still registered, and start() would find it and ride itself forever
      return await doStart(path, { ...opts, retry: false });
    } else {
      throw error;
    }
  } finally {
    stopConversionProgress();
  }
}

// ############################################################################################
// TODO: Remove this after a couple of months...
export async function legacyDeploy({
  path,
  target,
  targetContent,
}: DeployOptions): Promise<number> {
  if (deployServer) {
    await deployServer.stop();
  }
  const port = await getAvailablePort();
  const process = run('@dcl/sdk-commands', 'sdk-commands', {
    args: [
      'deploy',
      '--no-browser',
      '--port',
      port.toString(),
      ...(target ? ['--target', target] : []),
      ...(targetContent ? ['--target-content', targetContent] : []),
    ],
    cwd: path,
    env: await getEnv(path),
    workspace: path,
  });

  // App ready at
  await process.waitFor(/listening/i, /error:/i, { reject: 'stderr' });

  process.waitFor(/close the terminal/gi).then(() => process.kill());

  process.wait().catch(() => {}); // handle rejection of main promise to avoid warnings in console

  deployServer = { stop: () => process.kill() };

  return port;
}

async function readDeployCommandFile(path: string) {
  return fs.readFile(
    join(path, 'node_modules', '@dcl/sdk-commands/dist/commands/deploy/index.js'),
    'utf-8',
  );
}

async function shouldRunLegacyDeploy(path: string) {
  const file = await readDeployCommandFile(path);
  return !file.includes('--programmatic');
}

async function supportsMultiSceneDeploy(path: string) {
  const file = await readDeployCommandFile(path);
  return file.includes('--multi-scene');
}
// ############################################################################################

async function getComponents(path: string) {
  const filePath = join(path, 'node_modules', '@dcl/sdk-commands/dist/components/index.js');
  const { initComponents } = await dynamicImport(filePath);
  const components = await initComponents();
  return components;
}

async function runCommand(path: string, command: string, args: string[]) {
  const components = await getComponents(path);
  const filePath = join(path, 'node_modules', '@dcl/sdk-commands/dist/run-command.js');
  const { runSdkCommand } = await dynamicImport(filePath);
  return runSdkCommand(components, command, args);
}

export async function deploy({
  path,
  target,
  targetContent,
  language,
  chainId,
  wallet,
}: DeployOptions): Promise<number> {
  if (deployServer) {
    await deployServer.stop();
  }

  const isLegacyDeploy = await shouldRunLegacyDeploy(path);
  if (isLegacyDeploy) {
    log.info('[CLI] Running legacy deploy');
    return legacyDeploy({ path, target, targetContent, chainId, wallet });
  }

  const port = await getAvailablePort();
  const multiScene = await supportsMultiSceneDeploy(path);

  const { stop } = await runCommand(path, 'deploy', [
    '--dir',
    path,
    '--no-browser',
    '--port',
    port.toString(),
    ...(target ? ['--target', target] : []),
    ...(targetContent ? ['--target-content', targetContent] : []),
    '--programmatic',
    '--yes',
    ...(multiScene ? ['--multi-scene'] : []),
    ...(language ? ['--language', language] : []),
  ]);

  deployServer = { stop };

  return port;
}
