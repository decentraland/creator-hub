import { randomUUID } from 'crypto';
import { join } from 'path';
import fs from 'fs/promises';
import log from 'electron-log/main';
import { shell } from 'electron';
import QRCode from 'qrcode';

import type { PreviewOptions } from '/shared/types/settings';
import { PREVIEW_CLIENT } from '/shared/types/settings';
import {
  ClientError,
  CLIENT_NOT_INSTALLED_ERROR,
  isClientNotInstalledError,
} from '/shared/types/client';
import type { DeployOptions, DeployServer } from '/shared/types/deploy';
import { dynamicImport } from '/shared/dynamic-import';

import { dclDeepLink, run, type Child } from './bin';
import { getAvailablePort } from './port';
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

// Explorer opt-out from locally generated asset bundles (the Unity explorer's Local Scene
// Development default): it reads the param by presence only, and only at startup. It is
// not an sdk-commands flag, so it rides the passthrough after a standalone `--`, which
// sdk-commands forwards into the deeplink. An sdk-commands without that passthrough drops
// it silently, and the explorer then loads asset bundles.
const RAW_GLTF_PARAM = 'lsd-raw-gltf';

// Grace window for the mobile-QR deeplink to appear after the preview server reports
// ready. sdk-commands prints it only with a LAN IP; if none is found it never comes, so
// the mobile start settles (with no url) shortly after instead of hanging indefinitely.
const MOBILE_DEEPLINK_GRACE_MS = 5000;

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
// `loadRawGltfs` is an explorer param passed through after `--` in `doStart()`;
// `debugger`/`showWarnings` are renderer-only. Everything left maps to a flag.
type PreviewArguments = Omit<
  PreviewOptions,
  'debugger' | 'showWarnings' | 'loadRawGltfs' | 'client'
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
    log.warn('[CLI] getMobilePreview: no running preview to build the QR from');
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

    setOrDeleteParam(RAW_GLTF_PARAM, newOpts.loadRawGltfs);

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

// `mcpPort` is transient (not a user PreviewOptions setting): the Explorer-gateway
// launches a preview with `mcp: true` and needs the Explorer's MCP server on a known
// port so it can connect an MCP client to it. sdk-commands accepts `--mcp-port` (≥7.25.0)
// and forwards it to the Explorer as a deeplink param; omitted, the Explorer defaults to
// 8123. Only honoured on the Unity (`--explorer-alpha`) path alongside `--mcp`.
type StartOptions = PreviewOptions & { retry?: boolean; mobile?: boolean; mcpPort?: number };

// Serializes concurrent starts per path: a second Preview press (or a mobile-QR start)
// while a spawn is still booting must ride that spawn, not race a second one.
const inflightStarts = new Map<string, Promise<string>>();

export async function start(path: string, opts: StartOptions): Promise<string> {
  // A start is already underway (still booting): ride it instead of racing a
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

  // A mobile-QR start ignores the client option. The phone needs a LAN-reachable server
  // plus the `decentraland://open?preview=` deeplink, and only the Unity path prints that
  // (`--mobile` serves the scene without opening the desktop client); `--bevy-web` always
  // opens the browser client on top, which is not what a QR press asked for.
  const isMobile = !!opts.mobile;
  if (isMobile) opts = { ...opts, client: PREVIEW_CLIENT.DESKTOP };

  const preview = previewCache.get(path);

  // Any running preview (desktop client, Bevy tab, or an earlier QR start) already serves
  // the scene, and a QR only needs that server — so a mobile-QR start reuses whatever is
  // up instead of tearing down what the user has open. Decided here from the live process
  // rather than in the renderer, whose isPreviewRunning only flips back on an explicit kill.
  if (isPreviewRunning(preview) && isMobile) {
    return path;
  }

  // Otherwise reuse a running preview only if it's the same client — switching client
  // (Unity <-> Bevy) means a different launch, so tear the old one down and start fresh
  // below — and not a mobile-QR one: it never opened the desktop client, so a desktop
  // Preview press must restart to actually launch it.
  if (isPreviewRunning(preview) && preview.opts.client === opts.client && !preview.mobile) {
    if (opts.client === PREVIEW_CLIENT.BEVY_WEB) {
      // The Bevy web client runs in the browser; sdk-commands opened the tab on
      // launch and there's no deep-link to re-issue. Re-open the stored URL so a
      // second Preview click refocuses/reopens it. (`isPreviewRunning` already
      // guarantees a non-empty url.)
      await shell.openExternal(preview.url);
      return path;
    }

    // Desktop (Unity): the explorer reads the raw-GLTF opt-out only at startup, so a
    // refocus deeplink can't switch it — restart when the setting disagrees with the
    // running preview.
    const previewLoadsRawGltfs = new URLSearchParams(preview.url).has(RAW_GLTF_PARAM);
    if (!!opts.loadRawGltfs === previewLoadsRawGltfs) {
      // re-focus the already-open client, with the deeplink adjusted to the current options
      await dclDeepLink(updateDeepLinkWithOpts(preview.url, opts));
      return path;
    }
  }

  killPreview(path);

  const isBevyWeb = opts.client === PREVIEW_CLIENT.BEVY_WEB;

  try {
    // Three launches. Unity: sdk-commands self-opens the desktop client via the
    // `decentraland://` deeplink it prints (captured below only for the cache: re-focus,
    // option flips, mobile QR); every preview option (auth screen, terrains,
    // multi-instance, mcp, raw GLTFs, --hub) is a parameter of THAT launch, so only this
    // path takes them. Bevy (`--bevy-web`): it opens the hosted web client in the browser
    // itself and prints no deeplink, so we wait for the browser URL it prints. Mobile
    // (`--mobile`): it serves the scene and prints the LAN QR deeplink, opening no client
    // at all. Both are bare.
    const args = isMobile
      ? ['start', '--mobile']
      : isBevyWeb
        ? ['start', '--bevy-web']
        : [
            'start',
            '--explorer-alpha',
            '--hub',
            ...generatePreviewArguments(opts),
            // `--mcp` (a boolean) is emitted by generatePreviewArguments from opts.mcp;
            // pin the port too when the gateway asked for one, so it knows where to connect.
            ...(opts.mcp && opts.mcpPort !== undefined ? ['--mcp-port', String(opts.mcpPort)] : []),
            // must stay last: everything after `--` is forwarded to the explorer deeplink
            ...(opts.loadRawGltfs ? ['--', `--${RAW_GLTF_PARAM}`] : []),
          ];

    const process = run('@dcl/sdk-commands', 'sdk-commands', {
      args,
      cwd: path,
      workspace: path,
      env: await getEnv(path),
    });

    // registered before the deeplink resolves so a failed spawn is still killed below
    previewCache.set(path, { child: process, url: '', opts, mobile: isMobile });

    if (isBevyWeb) {
      // No deep-link on this path — sdk-commands opens the Bevy client in the browser
      // itself and prints the URL it opened. Wait for that URL line, not the earlier
      // "Preview server is now running" one: the URL lands in a LATER stdout chunk, so
      // reading the buffer on the server-ready line raced it and left the cached url
      // empty — `isPreviewRunning` then reported the live preview as not running (a
      // repeat Preview press respawned instead of refocusing, and the mobile QR bailed
      // silently). Raced against process death like the Unity path, so a spawn that dies
      // before printing rejects instead of leaving the inflight entry stuck.
      const bevyUrlPattern = /https?:\/\/\S*bevy-web\S*/i;
      const output = await Promise.race([
        process.waitFor(bevyUrlPattern, /CliError|error:/i),
        process.wait().then(() => {
          throw new Error('Preview process exited before printing the Bevy web URL');
        }),
      ]);

      // Stored so a repeat Preview click can reopen the tab (see the reuse fast-path above)
      const bevyUrl = output.match(bevyUrlPattern)?.[0] ?? '';
      const entry = previewCache.get(path);
      if (entry?.child === process) entry.url = bevyUrl;
      return path;
    }

    const dclLauncherURL = /decentraland:\/\/([^\s\n]*)/i;
    const spawned = (async () => {
      // waitFor resolves/rejects via `once` matchers that cleanup() disables the instant the
      // process exits (a natural exit, or an explicit kill). On its own it
      // would then hang forever if the process dies before printing a deeplink, leaving
      // inflightStarts[path] stuck and every later Preview press awaiting it. Race it against
      // process death so a failed spawn rejects here and the finally in start() clears
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
      // that does arrive still wins this race first.
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
    if (retry && !isClientNotInstalledError(error)) {
      log.info('[CLI] Something went wrong trying to start preview:', (error as Error).message);
      await install(path);
      // recurse into doStart, not start(): the wrapper's inflight entry (this very call)
      // is still registered, and start() would find it and ride itself forever
      return await doStart(path, { ...opts, retry: false });
    } else {
      throw error;
    }
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

// ############################################################################################

async function readDeployCommandFile(path: string) {
  return fs.readFile(
    join(path, 'node_modules', '@dcl/sdk-commands/dist/commands/deploy/index.js'),
    'utf-8',
  );
}

/** What the project's deploy command supports, read from its dist once per deploy. */
export type DeployCommandSupport = {
  /** Predates `--programmatic`, so it runs as a separate process. */
  legacy: boolean;
  multiScene: boolean;
  /** Serves `/api/deploy`: `routes.js` beside the command, or `respond-async` in its help text. */
  deployResource: boolean;
  /** `arg` rejects unknown flags, so `--deploy-token` is only passed when declared. */
  deployToken: boolean;
};

export async function getDeployCommandSupport(path: string): Promise<DeployCommandSupport> {
  const index = await readDeployCommandFile(path);
  const hasRoutes = await fs
    .stat(join(path, 'node_modules', '@dcl/sdk-commands/dist/commands/deploy/routes.js'))
    .then(
      () => true,
      () => false,
    );
  return {
    legacy: !index.includes('--programmatic'),
    multiScene: index.includes('--multi-scene'),
    deployResource: hasRoutes || index.includes('respond-async'),
    deployToken: index.includes('--deploy-token'),
  };
}

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

// The deploy start in flight. The next one waits for it, so it stops that CLI once it's tracked in
// `deployServer` instead of leaving it running untracked.
let deployStart: Promise<unknown> = Promise.resolve();

export function deploy(options: DeployOptions): Promise<DeployServer> {
  const start = deployStart.catch(() => undefined).then(() => startDeploy(options));
  deployStart = start;
  return start;
}

async function startDeploy({
  path,
  target,
  targetContent,
  language,
  chainId,
  wallet,
}: DeployOptions): Promise<DeployServer> {
  if (deployServer) {
    await deployServer.stop();
  }

  const support = await getDeployCommandSupport(path);
  if (support.legacy) {
    log.info('[CLI] Running legacy deploy');
    return {
      port: await legacyDeploy({ path, target, targetContent, chainId, wallet }),
      supportsDeployResource: false,
    };
  }

  const port = await getAvailablePort();
  const deployToken = support.deployResource && support.deployToken ? randomUUID() : undefined;

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
    ...(support.multiScene ? ['--multi-scene'] : []),
    ...(language ? ['--language', language] : []),
    ...(deployToken ? ['--deploy-token', deployToken] : []),
  ]);

  deployServer = { stop };

  return { port, supportsDeployResource: support.deployResource, deployToken };
}
