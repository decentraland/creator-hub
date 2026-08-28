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
import { getManagedBinDir, isSignedIn as isManagedSignedIn } from './ai-cli-paths';
import { getUserDataPath } from './electron';
import { getProjectId, track } from './analytics';
import {
  ensureSceneMcpServer,
  getTurnMutations,
  resetTurnMutations,
  type SceneMcpInfo,
  setSceneMcpProject,
  writeSceneMcpConfigFile,
} from './scene-mcp';
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
// Keep only the tail of a child's stderr — enough to surface a real error, bounded so a chatty
// process can't grow the buffer without limit.
const MAX_STDERR_BYTES = 8_000;
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
      // Capture $PATH plus the two API keys (for API-key billing on a GUI launch whose env
      // lacks them). The PATH marker keeps its shape so parseShellPath is unchanged; the key
      // markers are parsed separately. This output is NEVER logged.
      child = spawn(
        shell,
        [
          '-ilc',
          'printf "<<<%s>>>@@A=%s@@@@O=%s@@" "$PATH" "$ANTHROPIC_API_KEY" "$OPENAI_API_KEY"',
        ],
        { stdio: ['ignore', 'pipe', 'ignore'], detached: true },
      );
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
  // Capture the shell's API keys for API-key billing (in memory only; never logged).
  shellApiKeys.ANTHROPIC_API_KEY = /@@A=(.*?)@@/s.exec(out)?.[1] || undefined;
  shellApiKeys.OPENAI_API_KEY = /@@O=(.*?)@@/s.exec(out)?.[1] || undefined;
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
    // Include the app-managed CLI dir (#1531) so a CLI we installed on demand resolves
    // like a PATH install. Static path — fine to keep listed before anything is installed.
    cachedDirs = [...shellDirs, ...EXTRA_BIN_DIRS, ...nvmBinDirs(nvmRoot), getManagedBinDir()];
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

// ALWAYS dropped from the child: CLAUDE_CODE_* / CLAUDECODE (don't let the spawned CLI think
// it's nested in another session) and *BASE_URL / *CUSTOM_HEADERS (pin the endpoint so an
// inherited override can't redirect the OAuth token to a third party). Stripped even in
// API-key mode — a redirected endpoint is a security risk regardless of billing.
const ALWAYS_STRIP = new Set([
  'CLAUDECODE',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_CUSTOM_HEADERS',
  'ANTHROPIC_BEDROCK_BASE_URL',
  'ANTHROPIC_VERTEX_BASE_URL',
  'OPENAI_BASE_URL',
  'OPENAI_API_BASE',
]);

// Metered API keys: stripped by default to force subscription/OAuth billing (the whole
// point), but KEPT when the user opts into API-key-from-environment billing.
const API_KEY_ENV = new Set([
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'OPENAI_API_KEY',
  'CODEX_API_KEY',
]);

// API keys read from the user's login shell, so a GUI launch (sparse env) can still bill
// against a shell-configured key in API-key mode. Populated by the shell probe; only ever
// held in memory, never logged or persisted.
const shellApiKeys: { ANTHROPIC_API_KEY?: string; OPENAI_API_KEY?: string } = {};

// Filter an inherited env for a spawned CLI: always drop base-URL/session overrides; drop the
// metered API keys unless the user chose API-key billing. Exported for tests.
//
// FULL-CAPABILITY CAVEAT: beyond these vars, the child inherits the user's entire environment
// (AWS_*, GH_TOKEN, NPM_TOKEN, SSH agent, …) and runs under bypassPermissions/danger-full-access.
// That is by design — the assistant is the user's own CLI with the same reach it has in their
// terminal — and the guardrails are (a) it's an explicit Experimental opt-in the user turns on,
// and (b) the engine-owned-file denials in the system prompt. It is NOT resistant to prompt
// injection; treat that as the accepted trade-off of running a local coding agent. The
// Experimental settings copy tells the user the assistant runs with full system access.
export function filterEnvForChild(
  source: NodeJS.ProcessEnv,
  apiKeyFromEnv: boolean,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...source };
  for (const k of Object.keys(env)) {
    if (k.startsWith('CLAUDE_CODE') || ALWAYS_STRIP.has(k)) delete env[k];
    else if (!apiKeyFromEnv && API_KEY_ENV.has(k)) delete env[k];
  }
  return env;
}

// The child env: filter per the billing mode, keep everything else (HOME, keychain access),
// and widen PATH so the CLI finds its own `env node` shebang under a version manager. In
// API-key mode, fill any key the GUI env lacks from the login-shell probe.
function childEnv(apiKeyFromEnv: boolean): NodeJS.ProcessEnv {
  const env = filterEnvForChild(process.env, apiKeyFromEnv);
  if (apiKeyFromEnv) {
    for (const [k, v] of Object.entries(shellApiKeys)) {
      if (v !== undefined && v !== '' && env[k] === undefined) env[k] = v;
    }
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
  mcp?: SceneMcpInfo; // CH MCP server (scene + gateway tools); each provider wires it its own way
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
  // (for --resume) when the line carries one, else undefined. `image` is a data-URL an
  // MCP tool returned (e.g. an Explorer/editor screenshot), rendered inline in the chat.
  parseLine: (
    line: string,
    projectDir: string,
    emit: (text: string, tool?: [string, string], image?: string) => void,
  ) => string | undefined;
}

// Pull data-URL images out of a tool result's content blocks, for inline display in the
// chat (#1506). Claude relays an MCP image result as an Anthropic image block
// ({ type:'image', source:{ type:'base64', media_type, data } }); raw MCP content uses
// ({ type:'image', data, mimeType }). Handle both shapes.
function extractImages(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  const out: string[] = [];
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue;
    const b = block as Record<string, unknown>;
    if (b.type !== 'image') continue;
    const src = b.source as Record<string, unknown> | undefined;
    if (src !== undefined && src.type === 'base64' && typeof src.data === 'string') {
      const media = typeof src.media_type === 'string' ? src.media_type : 'image/png';
      out.push(`data:${media};base64,${src.data}`);
    } else if (typeof b.data === 'string') {
      const media = typeof b.mimeType === 'string' ? b.mimeType : 'image/png';
      out.push(`data:${media};base64,${b.data}`);
    }
  }
  return out;
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

// Codex reads the CH MCP server's bearer token from this env var (via the server config's
// `bearer_token_env_var`) rather than from argv — argv is visible to `ps` on the machine,
// and the token gates local scene control. aiSend sets it in the codex child's env.
const CODEX_MCP_TOKEN_ENV = 'CREATOR_HUB_MCP_TOKEN';

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
      // The CH MCP server (scene + Explorer-gateway tools). Merged with the user's own
      // MCP config, not strict — their servers stay available too. bypassPermissions
      // auto-allows the tool calls.
      if (ctx.mcp !== undefined) args.push('--mcp-config', writeSceneMcpConfigFile(ctx.mcp));
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
            content?: unknown; // tool_result payload (may hold image blocks)
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
      // Tool results come back as a `user` turn; an MCP screenshot arrives as image blocks
      // inside the tool_result — surface them so the chat shows what the assistant saw (#1506).
      if (obj.type === 'user' && obj.message?.content !== undefined) {
        for (const block of obj.message.content) {
          if (block.type === 'tool_result') {
            for (const url of extractImages(block.content)) emit('', undefined, url);
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
      // The CH MCP server (scene + Explorer-gateway tools), as a streamable-HTTP MCP server
      // defined via `-c` overrides (codex ≥0.148 supports HTTP natively; no flag). The `-c`
      // value after `=` is parsed as TOML, so the strings carry their own quotes. The bearer
      // token comes from an env var (set on the child in aiSend), not argv.
      if (ctx.mcp !== undefined) {
        args.push('-c', `mcp_servers.creator-hub.url="${ctx.mcp.url}"`);
        args.push('-c', `mcp_servers.creator-hub.bearer_token_env_var="${CODEX_MCP_TOKEN_ENV}"`);
      }
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
          server?: string; // mcp_tool_call: the MCP server name (e.g. "creator-hub")
          tool?: string; // mcp_tool_call: the tool name
          query?: string; // web_search
          result?: { content?: unknown }; // mcp_tool_call: the returned content (may hold images)
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
        // Scene/Explorer MCP tool calls → the same `mcp__<server>__<tool>` chip claude emits,
        // so the panel renders a readable tool name (create entity, screenshot, …). If the
        // result carried an image (an Explorer screenshot), surface it inline too (#1506).
        else if (item.type === 'mcp_tool_call' && item.tool !== undefined) {
          emit('', [`mcp__${item.server ?? 'mcp'}__${item.tool}`, '']);
          for (const url of extractImages(item.result?.content)) emit('', undefined, url);
        } else if (item.type === 'web_search') emit('', ['WebSearch', item.query ?? '']);
      }
      return undefined;
    },
  },
};

const scan = (): AiProviderInfo[] =>
  (Object.keys(PROVIDERS) as AiProvider[]).map(id => {
    const def = PROVIDERS[id];
    const bin = findExecutable(def.binNames);
    // A CLI we installed on demand (#1531) lives under the managed bin dir; unlike a
    // user-PATH install (which we assume is already logged in), it's only usable once its
    // subscription login completed, so gate its availability on the signed-in marker.
    const managed = bin !== null && bin.startsWith(getManagedBinDir());
    const signedIn = managed ? isManagedSignedIn(id) : true;
    const available = bin !== null && signedIn;
    return {
      id: def.id,
      label: def.label,
      models: def.models,
      defaultModel: def.defaultModel,
      available,
      reason: available
        ? undefined
        : bin === null
          ? `${def.label} not found — sign in with your subscription`
          : `${def.label} installed — finish signing in`,
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

// One turn at a time.
let current: { child: ChildProcess; turnId: string; done: boolean } | null = null;
let turnSeq = 0;

// Each provider's resume id, per project AND per local session, so consecutive turns chain
// into one conversation, each saved session resumes its own CLI thread, and it all survives
// an app restart (persisted to userData). Keyed by project dir because claude/codex validate
// --resume against the working directory — a session id from another project's cwd is
// rejected — then by the renderer's local session id (the scene's history entry). Loaded
// lazily (never at module init) so importing this module doesn't require an Electron app
// (keeps the unit tests electron-free).
type SessionResumeIds = Partial<Record<AiProvider, string>>;
type ProjectSessions = Record<string, SessionResumeIds>; // local sessionId → provider resume ids
let sessionsCache: Record<string, ProjectSessions> | null = null;

function sessionsFile(): string {
  return path.join(getUserDataPath(), 'ai-sessions.json');
}
function getSessions(): Record<string, ProjectSessions> {
  if (sessionsCache === null) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(sessionsFile(), 'utf8'));
      // Shape-guard: only accept a plain object-of-objects, so a corrupt/hand-edited file can't
      // spread arrays/primitives into the session map.
      sessionsCache =
        typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? (parsed as Record<string, ProjectSessions>)
          : {};
    } catch {
      sessionsCache = {}; // no file yet, or unreadable — start fresh
    }
  }
  return sessionsCache;
}
function saveSessions(): void {
  try {
    fs.writeFileSync(sessionsFile(), JSON.stringify(getSessions()));
  } catch (e) {
    log.warn('[AI] could not persist AI sessions:', e);
  }
}

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

// Drop the resume ids so the next turn starts a fresh conversation. Scoped to one project
// when given; clears everything when not (e.g. a full teardown). Stops the in-flight turn.
export function aiReset(projectDir?: string): void {
  aiStop();
  const store = getSessions();
  if (projectDir !== undefined) delete store[projectDir];
  else for (const key of Object.keys(store)) delete store[key];
  saveSessions();
}

// Drop one saved session's resume ids (when the user deletes it from the scene's history).
// Unlike aiReset it does NOT stop the current turn — a background session can be deleted
// while another is streaming.
export function aiDeleteSession(projectDir: string, sessionId: string): void {
  const proj = getSessions()[projectDir];
  if (proj !== undefined && sessionId in proj) {
    delete proj[sessionId];
    saveSessions();
  }
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

  // Point the CH MCP server at this project and hand it to the CLI (both providers get the
  // scene + Explorer-gateway tools; each wires the server its own way in buildArgs). If the
  // server can't start, degrade gracefully — the turn still runs without the tools (the CLI
  // can still read files directly).
  let mcp: SceneMcpInfo | undefined;
  try {
    mcp = await ensureSceneMcpServer();
    setSceneMcpProject(projectDir);
  } catch (e) {
    log.warn('[AI] MCP server unavailable, continuing without scene tools:', e);
  }

  aiStop(); // supersede any in-flight turn
  resetTurnMutations(); // start counting this turn's scene-graph changes for "revert turn"
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
  // Resume the CLI thread saved for THIS session (empty id = a default single bucket).
  const sessionId = params.sessionId ?? '';
  const args = def.buildArgs({
    text: prompt,
    model: params.model,
    projectDir,
    resume: getSessions()[projectDir]?.[sessionId]?.[params.provider],
    images,
    mcp,
  });

  const env = childEnv(params.apiKeyFromEnv ?? false);
  // Codex reads the MCP bearer token from this env var (see CODEX_MCP_TOKEN_ENV); keeping it
  // out of argv. Claude gets the token via its --mcp-config file instead, so it needs nothing here.
  if (params.provider === 'codex' && mcp !== undefined) env[CODEX_MCP_TOKEN_ENV] = mcp.token;

  let child: ChildProcess;
  try {
    child = spawn(bin, args, {
      cwd: projectDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32', // own process group so killTree reaps children
    });
  } catch (e) {
    throw new Error(`failed to launch ${def.label}: ${String(e)}`);
  }

  const turn = { child, turnId, done: false };
  current = turn;
  emit({ kind: 'started', turnId });

  // Usage analytics (fire-and-forget, never blocks the turn; no prompt/scene content, only
  // the anonymous project id + provider/model + turn outcome). Resolve the project id once
  // and reuse it for both the start and completion events.
  const startedAt = Date.now();
  let toolCount = 0;
  const projectIdPromise = getProjectId(projectDir).catch((): string => '');
  void projectIdPromise.then(project_id =>
    track('AI Turn Started', {
      project_id,
      provider: params.provider,
      model: params.model ?? 'default',
    }),
  );

  const finish = (ok: boolean, message?: string): void => {
    if (turn.done) return;
    turn.done = true;
    if (message !== undefined) emit({ kind: 'error', turnId, message });
    emit({ kind: 'done', turnId, ok, mutations: getTurnMutations() });
    if (current === turn) current = null;
    void projectIdPromise.then(project_id =>
      track('AI Turn Completed', {
        project_id,
        provider: params.provider,
        model: params.model ?? 'default',
        ok,
        duration_ms: Date.now() - startedAt,
        tool_count: toolCount,
        mutations: getTurnMutations(),
      }),
    );
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
    const session = def.parseLine(line, projectDir, (text, tool, image) => {
      if (text !== '') emit({ kind: 'text', turnId, text });
      if (tool !== undefined) {
        toolCount++;
        emit({ kind: 'tool', turnId, tool: tool[0], detail: tool[1] });
      }
      if (image !== undefined) emit({ kind: 'image', turnId, dataUrl: image });
    });
    if (session !== undefined) {
      const store = getSessions();
      const proj = (store[projectDir] ??= {});
      (proj[sessionId] ??= {})[params.provider] = session;
      saveSessions(); // persist so the conversation resumes after an app restart
    }
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
    if (stderr.length > MAX_STDERR_BYTES) stderr = stderr.slice(-MAX_STDERR_BYTES);
  });
  child.on('error', e => finish(false, `assistant failed to start: ${e.message}`));
  child.on('exit', (code, signal) => {
    buf += outDec.end();
    if (buf.trim() !== '') onLine(buf.trim()); // flush a trailing partial line
    if (code === 0) finish(true);
    // code === null means a signal killed the child. An intentional `aiStop()` already marked
    // the turn done (so finish() no-ops there); reaching here means an UNsolicited kill (OOM,
    // external SIGKILL) — report it as an interruption, never as a successful turn.
    else if (code === null) finish(false, `assistant was interrupted (${signal ?? 'signal'})`);
    else finish(false, (stderr + errDec.end()).trim() || `assistant exited with code ${code}`);
  });

  log.info(`[AI] Started ${def.label} turn ${turnId} in ${projectDir}`);
  return { turnId };
}
