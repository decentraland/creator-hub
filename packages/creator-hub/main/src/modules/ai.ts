// In-app AI assistant: drives a local AI *CLI* (Claude Code / Codex) as a child
// process, one per user turn, with the open project as its working directory. It runs
// on the user's own subscription/OAuth session — API keys are stripped from the child
// env on purpose (metered keys are the thing we're avoiding) — reads the scene and
// edits the project's src/*.ts files directly on disk; sdk-commands rebuilds on write.
// The renderer only sends prompts and renders the streamed events; all spawning
// happens here in the main process.
//
// This is the raw-spawn transport (proven in the Bevy editor). It lives behind the
// `ai.*` IPC surface so it can later be swapped for an ACP client without touching the
// renderer panel or the IPC contract.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { StringDecoder } from 'string_decoder';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import log from 'electron-log/main';
import type { AiEvent, AiProvider, AiProviderInfo, AiSendParams } from '/shared/types/ai';
import { DCL_SYSTEM_PROMPT } from './ai-prompt';
import { ensureSceneMcpServer, setSceneMcpProject, writeSceneMcpConfigFile } from './scene-mcp';
import { ensureSkillsLinked } from './skills';

// GUI-launched Electron gets a sparse PATH (no shell profile), so the CLIs — and their
// own node/child lookups — won't be found by name alone. Search these in addition to
// whatever PATH we do have.
const HOME = os.homedir();
const EXTRA_BIN_DIRS = [
  path.join(HOME, '.local', 'bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  path.join(HOME, '.bun', 'bin'),
  path.join(HOME, '.deno', 'bin'),
  path.join(HOME, '.volta', 'bin'),
];

// nvm earns a special case: it is where `npm i -g` actually lands for most people, and
// its layout is fixed. The login-shell probe below covers it only when nvm is loaded
// eagerly — a lazy-loading profile (a common speed trick) leaves node off PATH until
// something triggers it. Newest version first, since that is where a fresh `npm i -g`
// installed.
export function nvmBinDirs(nvmRoot: string): string[] {
  try {
    return fs
      .readdirSync(nvmRoot, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('v'))
      .map(e => e.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map(v => path.join(nvmRoot, v, 'bin'));
  } catch {
    return []; // no nvm here
  }
}

// A GUI launch inherits launchd's PATH — often just /usr/bin:/bin — so a signed-in CLI
// installed under a Node version manager reads as "not installed". Ask the login shell
// where its PATH actually points. `-i` matters: nvm and fnm set PATH from
// .zshrc/.bashrc, not the profile. Marker-delimited because an interactive shell may
// print banners of its own.
const SHELL_PATH_TIMEOUT_MS = 5_000;
let shellDirs: string[] = [];
let probing: Promise<void> | null = null;

// The panel's mount and a Recheck click both land here; with no CLI installed each
// would otherwise spawn its own login shell. Share the one in-flight probe; the next
// call after it settles starts a fresh one, which is what makes Recheck-after-install
// work.
function loadShellDirs(): Promise<void> {
  probing ??= runShellProbe().finally(() => (probing = null));
  return probing;
}

async function runShellProbe(): Promise<void> {
  if (process.platform === 'win32') return; // GUI apps there inherit the real PATH
  const shell = process.env.SHELL ?? '/bin/zsh';
  const out = await new Promise<string>(resolve => {
    let child: ChildProcess;
    try {
      // detached: the profile may spawn its own children (a version manager resolving a
      // default), and killing only the shell would orphan them.
      child = spawn(shell, ['-ilc', 'printf "<<<%s>>>" "$PATH"'], {
        stdio: ['ignore', 'pipe', 'ignore'],
        detached: true,
      });
    } catch {
      resolve('');
      return;
    }
    let buf = '';
    const timer = setTimeout(() => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL'); // the group
      } catch {
        child.kill('SIGKILL');
      }
      resolve(buf); // a heavy or interactive profile must not hang the probe
    }, SHELL_PATH_TIMEOUT_MS);
    child.stdout?.on('data', (d: Buffer) => (buf += String(d)));
    child.on('error', () => {
      clearTimeout(timer);
      resolve('');
    });
    child.on('close', () => {
      clearTimeout(timer);
      resolve(buf);
    });
  });
  const dirs = parseShellPath(out);
  if (dirs.length > 0) {
    shellDirs = dirs; // no marker: keep what we had, the static list still applies
    cachedDirs = null;
  }
}

// Everywhere worth looking, best evidence first: the user's own shell, then the static
// guesses, then nvm's versioned dirs. Resolved once per probe rather than per lookup.
let cachedDirs: string[] | null = null;
function searchDirs(): string[] {
  if (cachedDirs === null) {
    const nvmRoot = path.join(process.env.NVM_DIR ?? path.join(HOME, '.nvm'), 'versions', 'node');
    cachedDirs = [...shellDirs, ...EXTRA_BIN_DIRS, ...nvmBinDirs(nvmRoot)];
  }
  return cachedDirs;
}

// Split on ':', not path.delimiter: this is a POSIX shell's $PATH, and the probe that
// produces it never runs on Windows — so the separator is a property of the value.
export function parseShellPath(out: string): string[] {
  const found = /<<<(.*?)>>>/s.exec(out);
  return found === null ? [] : found[1].split(':').filter(Boolean);
}

// Find an installed, *runnable* binary by any of its names. realpathSync throws on a
// dangling symlink (e.g. a cask whose target was upgraded away), so a broken install
// reads as "not found" instead of spawning garbage.
function findExecutable(names: string[]): string | null {
  const pathDirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const dirs = [...pathDirs, ...searchDirs()];
  for (const dir of dirs) {
    for (const name of names) {
      const p = path.join(dir, name);
      try {
        const real = fs.realpathSync(p); // resolves & proves the target exists
        if (fs.statSync(real).isFile()) {
          fs.accessSync(real, fs.constants.X_OK);
          return p; // return the found path (spawn follows the symlink itself)
        }
      } catch {
        /* not here, or dangling — keep looking */
      }
    }
  }
  return null;
}

// Env vars dropped from the child. Metered API keys → force subscription/OAuth auth
// (the whole point). CLAUDE_CODE_* / CLAUDECODE → don't let the spawned CLI think it's
// nested in another Claude Code session. *BASE_URL / *CUSTOM_HEADERS → pin the endpoint
// so an inherited override can't redirect the OAuth token to a third party.
const STRIP_ENV = new Set([
  'CLAUDECODE',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_CUSTOM_HEADERS',
  'ANTHROPIC_BEDROCK_BASE_URL',
  'ANTHROPIC_VERTEX_BASE_URL',
  'OPENAI_API_KEY',
  'CODEX_API_KEY',
  'OPENAI_BASE_URL',
  'OPENAI_API_BASE',
]);

// The child env: strip the vars above, keep everything else (HOME, keychain access),
// and widen PATH so the CLI finds its own `env node` shebang under a version manager.
function childEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k.startsWith('CLAUDE_CODE') || STRIP_ENV.has(k)) delete env[k];
  }
  env.PATH = [...(env.PATH ?? '').split(path.delimiter), ...searchDirs()]
    .filter(Boolean)
    .join(path.delimiter);
  return env;
}

interface TurnCtx {
  text: string;
  model?: string;
  projectDir: string;
  resume?: string;
  images: string[]; // temp-file paths of attached images (already written to disk)
  mcpConfigPath?: string; // CH MCP server config file (scene read tools), when available
}

// A provider = how to find its binary + how to turn a turn into an argv + how to read
// its streaming stdout. Only these two things differ between Claude and Codex.
interface ProviderDef {
  id: AiProvider;
  label: string;
  binNames: string[];
  models: string[];
  defaultModel: string;
  buildArgs: (ctx: TurnCtx) => string[];
  // Parse one NDJSON stdout line. Emit chat events; return a session id to remember
  // (for --resume) when the line carries one, else undefined.
  parseLine: (
    line: string,
    projectDir: string,
    emit: (text: string, tool?: [string, string]) => void,
  ) => string | undefined;
}

// A short, scene-relative label for a tool's target path. The CLIs report absolute,
// symlink-resolved paths, so a naive path.relative can climb out with ../../ — prefer
// the meaningful src/… suffix, and fall back to the basename over a traversal chain.
function rel(projectDir: string, p: unknown): string {
  if (typeof p !== 'string' || p === '') return '';
  const srcIdx = p.lastIndexOf('/src/');
  if (srcIdx >= 0) return p.slice(srcIdx + 1);
  try {
    const r = path.relative(projectDir, p);
    return r === '' || r.startsWith('..') ? path.basename(p) : r;
  } catch {
    return path.basename(p);
  }
}

// What a tool chip shows after its name. File tools report paths; for the rest, prefer
// what a creator can read — Bash's human description over the raw command, a search's
// pattern over nothing.
function toolDetail(tool: string, inp: Record<string, unknown>, projectDir: string): string {
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const clip = (s: string): string => (s.length > 64 ? s.slice(0, 64) + '…' : s);
  const file = rel(projectDir, inp.file_path ?? inp.path ?? '');
  if (file !== '') return file;
  if (tool === 'Bash')
    return clip(str(inp.description) !== '' ? str(inp.description) : str(inp.command));
  if (tool === 'Grep' || tool === 'Glob') return clip(str(inp.pattern));
  if (tool === 'WebSearch') return clip(str(inp.query));
  if (tool === 'WebFetch') return clip(str(inp.url));
  if (tool === 'Task') return clip(str(inp.description));
  return '';
}

// Exported for the parser tests: parseLine tracks two external CLIs' output formats, so
// a format change has to be caught by something.
export const PROVIDERS: Record<AiProvider, ProviderDef> = {
  claude: {
    id: 'claude',
    label: 'Claude',
    binNames: ['claude'],
    models: ['default', 'opus', 'sonnet', 'haiku'],
    defaultModel: 'default',
    buildArgs: ctx => {
      const args = [
        '-p',
        ctx.text,
        '--output-format',
        'stream-json',
        '--verbose', // required alongside stream-json under -p
        // Full capability, no prompts: the assistant runs shell (npx, sdk-commands),
        // reads docs off the network, and applies edits — the SDK skills it follows are
        // built around those. No allowlist: an allowlist only ADDS to whatever the
        // user's own ~/.claude settings already grant, so it made capability differ per
        // machine while guaranteeing nothing. The engine-owned-file guardrail lives in
        // the system prompt (see ai-prompt.ts).
        '--permission-mode',
        'bypassPermissions',
        '--append-system-prompt',
        DCL_SYSTEM_PROMPT,
      ];
      if (ctx.model !== undefined && ctx.model !== 'default') args.push('--model', ctx.model);
      if (ctx.resume !== undefined) args.push('--resume', ctx.resume);
      // The CH MCP server (read-only scene tools). Merged with the user's own MCP
      // config, not strict — their servers stay available too. bypassPermissions
      // auto-allows the tool calls.
      if (ctx.mcpConfigPath !== undefined) args.push('--mcp-config', ctx.mcpConfigPath);
      // images travel as paths inside the prompt — claude's Read tool renders image
      // files natively, no dedicated flag exists (or is needed)
      return args;
    },
    parseLine: (line, projectDir, emit) => {
      let obj: {
        type?: string;
        subtype?: string;
        session_id?: string;
        is_error?: boolean;
        message?: {
          content?: Array<{
            type?: string;
            text?: string;
            name?: string;
            input?: Record<string, unknown>;
          }>;
        };
      };
      try {
        obj = JSON.parse(line);
      } catch {
        return undefined; // non-JSON chatter — ignore
      }
      if (obj.type === 'system' && obj.subtype === 'init') return obj.session_id;
      if (obj.type === 'assistant' && obj.message?.content !== undefined) {
        for (const block of obj.message.content) {
          if (block.type === 'text' && block.text !== undefined && block.text !== '')
            emit(block.text);
          else if (block.type === 'tool_use' && block.name !== undefined) {
            emit('', [block.name, toolDetail(block.name, block.input ?? {}, projectDir)]);
          }
        }
      }
      if (obj.type === 'result') return obj.session_id;
      return undefined;
    },
  },
  // Codex, wired against `codex exec --json` (its non-interactive JSONL mode). Resume is
  // a SUBCOMMAND (`codex exec resume <threadId>`), not a flag; the thread id comes from
  // the `thread.started` event. codex ≥0.145 removed the --ask-for-approval flag, so the
  // policy is pinned through `-c` instead (also overrides a user config.toml that asks
  // for approvals — we spawn with stdin ignored, so a prompt would hang forever);
  // `--sandbox danger-full-access` is the bypassPermissions equivalent;
  // `--skip-git-repo-check` lets it run in a scene folder that isn't a git repo. Present
  // so a signed-in Codex works out of the box; the UI defaults to Claude.
  codex: {
    id: 'codex',
    label: 'Codex',
    binNames: ['codex'],
    models: ['default', 'gpt-5-codex', 'gpt-5'],
    defaultModel: 'default',
    buildArgs: ctx => {
      const base = ctx.resume !== undefined ? ['exec', 'resume', ctx.resume] : ['exec'];
      const args = [
        ...base,
        '--json',
        '-C',
        ctx.projectDir,
        '--sandbox',
        'danger-full-access',
        '-c',
        'approval_policy="never"',
        '--skip-git-repo-check',
      ];
      if (ctx.model !== undefined && ctx.model !== 'default') args.push('--model', ctx.model);
      for (const img of ctx.images) args.push('-i', img); // codex's native image flag
      // `codex exec` has no system-prompt flag, so the rules ride in front of the prompt
      // on every turn, matching claude's --append-system-prompt.
      args.push(`${DCL_SYSTEM_PROMPT}\n\n---\n\n${ctx.text}`);
      return args;
    },
    parseLine: (line, projectDir, emit) => {
      let obj: {
        type?: string;
        thread_id?: string;
        item?: {
          type?: string;
          text?: string;
          command?: string;
          changes?: Array<{ path?: string }>;
        };
      };
      try {
        obj = JSON.parse(line);
      } catch {
        return undefined;
      }
      if (obj.type === 'thread.started') return obj.thread_id;
      // act only on completed items (started/updated are partial and would dup)
      if (obj.type === 'item.completed' && obj.item !== undefined) {
        const item = obj.item;
        if (item.type === 'agent_message' && item.text !== undefined && item.text !== '')
          emit(item.text);
        else if (item.type === 'file_change')
          for (const ch of item.changes ?? []) emit('', ['Edit', rel(projectDir, ch.path ?? '')]);
        else if (item.type === 'command_execution' && item.command !== undefined)
          emit('', ['Run', item.command]);
      }
      return undefined;
    },
  },
};

const scan = (): AiProviderInfo[] =>
  (Object.keys(PROVIDERS) as AiProvider[]).map(id => {
    const def = PROVIDERS[id];
    const bin = findExecutable(def.binNames);
    return {
      id: def.id,
      label: def.label,
      models: def.models,
      defaultModel: def.defaultModel,
      available: bin !== null,
      reason: bin === null ? `${def.label} CLI not found — install it and sign in` : undefined,
    };
  });

// Cheap scan first; only pay for the login shell when something is missing — which is
// also exactly when the user presses Recheck after installing.
export async function detectProviders(): Promise<AiProviderInfo[]> {
  cachedDirs = null; // an explicit check re-reads the disk: they may have just installed
  const first = scan();
  if (first.every(p => p.available)) return first;
  await loadShellDirs();
  return scan();
}

// One turn at a time. `sessions` holds each provider's resume id so consecutive turns
// chain into a single conversation until aiReset().
let current: { child: ChildProcess; turnId: string; done: boolean } | null = null;
const sessions: Partial<Record<AiProvider, string>> = {};
let turnSeq = 0;

function killTree(child: ChildProcess): void {
  child.stdout?.removeAllListeners('data');
  child.stderr?.removeAllListeners('data');
  if (child.pid === undefined) return;
  try {
    if (process.platform === 'win32') child.kill();
    else process.kill(-child.pid, 'SIGKILL'); // whole detached group
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }
}

// Is a turn's CLI child running? It edits project files on disk, so the updater refuses
// to restart the app mid-turn.
export function aiBusy(): boolean {
  return current !== null;
}

export function aiStop(): void {
  if (current === null) return;
  const c = current;
  current = null;
  if (!c.done) {
    c.done = true;
    killTree(c.child);
  }
}

export function aiReset(): void {
  aiStop();
  delete sessions.claude;
  delete sessions.codex;
}

// Attached images, written to one temp dir per turn. Kept for the whole app session
// (not deleted when the turn ends): with --resume the conversation can come back to an
// image several turns later, and the CLI re-reads it from the same path.
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMG_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

function writeAttachments(images: AiSendParams['images']): string[] {
  if (images === undefined || images.length === 0) return [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-hub-ai-'));
  const out: string[] = [];
  for (const [i, img] of images.slice(0, MAX_IMAGES).entries()) {
    const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(img.dataUrl);
    if (m === null) continue;
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) continue;
    const p = path.join(dir, `image-${i + 1}${IMG_EXT[m[1]] ?? '.png'}`);
    fs.writeFileSync(p, buf);
    out.push(p);
  }
  return out;
}

// Spawn one turn and stream its events through `emit`. Returns as soon as the child is
// running (with the turn id) — the conversation streams asynchronously; it does NOT
// wait for the turn to finish.
export async function aiSend(
  params: AiSendParams,
  projectDir: string | null,
  emit: (e: AiEvent) => void,
): Promise<{ turnId: string }> {
  if (projectDir === null || projectDir === '')
    throw new Error('Open a scene before using the assistant.');
  const def = PROVIDERS[params.provider];
  if (def === undefined) throw new Error(`Unknown assistant "${params.provider}".`);
  const bin = findExecutable(def.binNames);
  if (bin === null) throw new Error(`${def.label} CLI not found — install it and sign in.`);

  // Link the Decentraland SDK7 skills into the project so the CLI finds them in its
  // cwd (both providers). Best-effort — a missing/failed cache just means no skills
  // this turn. The first turn after launch may wait briefly for the initial download.
  try {
    await ensureSkillsLinked(projectDir);
  } catch (e) {
    log.warn('[AI] could not link SDK skills:', e);
  }

  // Point the CH MCP server at this project and hand its config to the CLI. If the
  // server can't start, degrade gracefully — the turn still runs, just without the
  // scene read tools (the CLI can still read files directly). Claude only for now;
  // Codex MCP wiring is a later phase.
  let mcpConfigPath: string | undefined;
  if (params.provider === 'claude') {
    try {
      const mcp = await ensureSceneMcpServer();
      setSceneMcpProject(projectDir);
      mcpConfigPath = writeSceneMcpConfigFile(mcp);
    } catch (e) {
      log.warn('[AI] MCP server unavailable, continuing without scene tools:', e);
    }
  }

  aiStop(); // supersede any in-flight turn
  const turnId = `t${++turnSeq}`;
  // Prepend editor context (when present) to the prompt so the assistant sees editor
  // state without the user retyping it. Not shown in the chat bubble.
  let prompt =
    params.context !== undefined && params.context !== ''
      ? `${params.context}\n\n---\n\n${params.text}`
      : params.text;
  const images = writeAttachments(params.images);
  if (images.length > 0) {
    prompt += `\n\n[The user attached ${
      images.length === 1 ? 'an image' : `${images.length} images`
    } to this message — view ${images.length === 1 ? 'it' : 'them'} before answering:\n${images.join('\n')}]`;
  }
  const args = def.buildArgs({
    text: prompt,
    model: params.model,
    projectDir,
    resume: sessions[params.provider],
    images,
    mcpConfigPath,
  });

  let child: ChildProcess;
  try {
    child = spawn(bin, args, {
      cwd: projectDir,
      env: childEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32', // own process group so killTree reaps children
    });
  } catch (e) {
    throw new Error(`failed to launch ${def.label}: ${String(e)}`);
  }

  const turn = { child, turnId, done: false };
  current = turn;
  emit({ kind: 'started', turnId });

  const finish = (ok: boolean, message?: string): void => {
    if (turn.done) return;
    turn.done = true;
    if (message !== undefined) emit({ kind: 'error', turnId, message });
    emit({ kind: 'done', turnId, ok });
    if (current === turn) current = null;
  };

  let stderr = '';
  let buf = '';
  // StringDecoder buffers a multibyte UTF-8 codepoint split across two stdout chunks; a
  // plain buf += d.toString() would decode each half alone and emit U+FFFD, corrupting
  // emoji/i18n text mid-stream.
  const outDec = new StringDecoder('utf8');
  const errDec = new StringDecoder('utf8');
  const onLine = (line: string): void => {
    if (line === '') return;
    const session = def.parseLine(line, projectDir, (text, tool) => {
      if (text !== '') emit({ kind: 'text', turnId, text });
      if (tool !== undefined) emit({ kind: 'tool', turnId, tool: tool[0], detail: tool[1] });
    });
    if (session !== undefined) sessions[params.provider] = session;
  };

  child.stdout?.on('data', (d: Buffer) => {
    buf += outDec.write(d);
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      onLine(buf.slice(0, nl).trim());
      buf = buf.slice(nl + 1);
    }
  });
  child.stderr?.on('data', (d: Buffer) => {
    stderr += errDec.write(d);
    if (stderr.length > 8000) stderr = stderr.slice(-8000);
  });
  child.on('error', e => finish(false, `assistant failed to start: ${e.message}`));
  child.on('exit', code => {
    buf += outDec.end();
    if (buf.trim() !== '') onLine(buf.trim()); // flush a trailing partial line
    if (code === 0 || code === null) finish(true);
    else finish(false, (stderr + errDec.end()).trim() || `assistant exited with code ${code}`);
  });

  log.info(`[AI] Started ${def.label} turn ${turnId} in ${projectDir}`);
  return { turnId };
}
