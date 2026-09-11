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
import { spawn, spawnSync } from 'child_process';
import type { ChildProcess } from 'child_process';
// The turn child is an npm-installed CLI. On Windows that's a `.cmd` shim, which child_process
// can't spawn directly with an arg array (the prompt would need cmd.exe escaping); cross-spawn
// handles the `.cmd` + quoting correctly and is a transparent drop-in for spawn on macOS/Linux.
import crossSpawn from 'cross-spawn';
import log from 'electron-log/main';
import type { AiEvent, AiProvider, AiProviderInfo, AiSendParams } from '/shared/types/ai';
import { DCL_SYSTEM_PROMPT } from './ai-prompt';
import { CLI_SPECS, getManagedBinDir, isSignedIn as isManagedSignedIn } from './ai-cli-paths';
import { getUserDataPath } from './electron';
import { getProjectId, track } from './analytics';
import {
  clearPendingAsks,
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
  // On Windows npm links a CLI as `<name>.cmd` (+ `.ps1` + an extensionless POSIX shebang
  // script that is NOT a runnable PE). Prefer the `.cmd`/`.exe`, or spawn hands CreateProcess
  // the shebang script → ERROR_BAD_EXE_FORMAT (exit 193). accessSync(X_OK) can't catch it —
  // there's no execute bit on Windows. cross-spawn (used for the turn) runs the `.cmd` safely.
  const candidates =
    process.platform === 'win32' ? names.flatMap(n => [`${n}.cmd`, `${n}.exe`, n]) : names;
  for (const dir of dirs) {
    for (const name of candidates) {
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

// `<bin> --version` prints e.g. "2.1.260 (Claude Code)". Best-effort: a probe failure or an
// unparseable line yields undefined and the UI simply won't nudge — this only gates a proactive
// hint, never the turn (the raw-error rewrite below covers a too-old CLI regardless). Cached per
// resolved path: scan() runs on every panel open/recheck and a CLI's version only changes on
// reinstall; detectProviders() clears the cache on an explicit recheck so an update is re-read.
// Windows note: a bare spawnSync of a `.cmd` shim can fail (see the turn's cross-spawn use) — the
// probe just returns undefined there, so Windows loses the proactive hint but not the rewrite.
const cliVersionCache = new Map<string, string | undefined>();

function getCliVersion(bin: string): string | undefined {
  if (cliVersionCache.has(bin)) return cliVersionCache.get(bin);
  let version: string | undefined;
  try {
    const res = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 5000 });
    const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
    const m = out.match(/(\d+\.\d+\.\d+)/);
    version = m ? m[1] : undefined;
  } catch {
    version = undefined;
  }
  cliVersionCache.set(bin, version);
  return version;
}

// The CLI relays an API 400 as a raw JSON blob when the installed version is too old for the
// requested model (a Fable/newer model set as the user's own CLI default — the Creator Hub
// never selects it, it only omits `--model` and lets the CLI use its default). Swap that blob
// for one short actionable line; the payload itself is noise to the user. English to match the
// other hard-coded turn-status strings in this module.
export function friendlyCliError(text: string): string {
  if (/claude_code_version_too_old/.test(text) || /does not support this model/.test(text)) {
    return 'Your installed Claude CLI is too old for the selected model. Update it — run `claude update` in a terminal, or update the Claude app — then try again.';
  }
  return text;
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
  'CURSOR_API_KEY',
  // Gemini's metered keys. NOT its auth-method selectors (GOOGLE_GENAI_USE_GCA / _USE_VERTEXAI) —
  // those pick the Google-login/Vertex path we WANT to keep in subscription mode.
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
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

// A built invocation: the argv, plus any text to feed on stdin instead of argv. On Windows,
// cross-spawn runs the CLI's `.cmd` shim through `cmd.exe /c`, whose command line is capped at
// 8191 chars — the ~7KB DCL system prompt on argv overflowed it on its own ("The command line
// is too long"), so every turn failed regardless of the user's prompt size. Big text now rides
// OFF argv: Claude takes the system prompt from a file (--append-system-prompt-file) and the
// user prompt on stdin; Codex takes both (rules + prompt) on stdin via the `-` prompt token.
interface BuiltTurn {
  args: string[];
  stdin?: string;
}

// A provider = how to find its binary + how to turn a turn into an argv (+ stdin) + how to read
// its streaming stdout. Only these things differ between Claude and Codex.
interface ProviderDef {
  id: AiProvider;
  label: string;
  binNames: string[];
  models: string[];
  defaultModel: string;
  // Optional on-disk setup run once per turn, before the child spawns, for a CLI that takes
  // its rules/config from project files rather than flags (Cursor). Best-effort: a failure is
  // logged and the turn still runs (degraded). Kept out of buildArgs so buildArgs stays pure
  // and unit-testable — it must never write into the project dir.
  prepareTurn?: (ctx: TurnCtx) => void;
  buildArgs: (ctx: TurnCtx) => BuiltTurn;
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

// Cursor's stream-json reports a tool call as a single-key object `{ <name>ToolCall: {...} }`
// (readToolCall, writeToolCall, shellToolCall, …). Map the base name to the same chip labels
// claude/codex use so the panel renders a readable tool name.
const CURSOR_TOOL_NAMES: Record<string, string> = {
  read: 'Read',
  write: 'Write',
  edit: 'Edit',
  delete: 'Delete',
  ls: 'List',
  glob: 'Glob',
  grep: 'Grep',
  shell: 'Run',
  search: 'Search',
};

// Turn a cursor `tool_call` object into a [chip-name, detail] pair. Prefers the target file
// path; falls back to the command/pattern/query for shell and search tools.
function cursorTool(
  toolCall: Record<string, { args?: Record<string, unknown> }>,
  projectDir: string,
): [string, string] | null {
  const key = Object.keys(toolCall)[0];
  if (key === undefined) return null;
  const base = key.replace(/ToolCall$/, '');
  const name = CURSOR_TOOL_NAMES[base] ?? base.charAt(0).toUpperCase() + base.slice(1);
  const args = toolCall[key]?.args ?? {};
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const clip = (s: string): string => (s.length > 64 ? s.slice(0, 64) + '…' : s);
  const file = rel(projectDir, args.path ?? args.file_path ?? '');
  const detail =
    file !== '' ? file : clip(str(args.command) || str(args.pattern) || str(args.query));
  return [name, detail];
}

// Gemini's built-in tools are snake_case (`read_file`, `run_shell_command`, …). Map the common
// ones to the same chip labels claude/codex use; unknown names pass through unchanged.
const GEMINI_TOOL_NAMES: Record<string, string> = {
  read_file: 'Read',
  read_many_files: 'Read',
  write_file: 'Write',
  replace: 'Edit',
  edit: 'Edit',
  run_shell_command: 'Run',
  search_file_content: 'Grep',
  glob: 'Glob',
  list_directory: 'List',
  web_fetch: 'WebFetch',
  google_web_search: 'WebSearch',
};

// Turn a gemini `tool_use` event's name + parameters into a [chip-name, detail] pair. Gemini's
// file tools use absolute_path/file_path/path; shell uses command; search uses pattern/query.
function geminiTool(
  toolName: string,
  parameters: Record<string, unknown> | undefined,
  projectDir: string,
): [string, string] {
  const name = GEMINI_TOOL_NAMES[toolName] ?? toolName;
  const args = parameters ?? {};
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
  const clip = (s: string): string => (s.length > 64 ? s.slice(0, 64) + '…' : s);
  const file = rel(projectDir, args.absolute_path ?? args.file_path ?? args.path ?? '');
  const detail =
    file !== ''
      ? file
      : clip(str(args.command) || str(args.pattern) || str(args.query) || str(args.url));
  return [name, detail];
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
        // The ~7KB system prompt goes via a file, not `--append-system-prompt <string>`: on
        // Windows the inline string alone overflowed cmd.exe's 8191-char command line (see
        // BuiltTurn). Mac/Linux are unaffected but read the same file.
        '--append-system-prompt-file',
        writeSystemPromptFile(DCL_SYSTEM_PROMPT),
      ];
      if (ctx.model !== undefined && ctx.model !== 'default') args.push('--model', ctx.model);
      if (ctx.resume !== undefined) args.push('--resume', ctx.resume);
      // The CH MCP server (scene + Explorer-gateway tools). Merged with the user's own
      // MCP config, not strict — their servers stay available too. bypassPermissions
      // auto-allows the tool calls.
      if (ctx.mcp !== undefined) args.push('--mcp-config', writeSceneMcpConfigFile(ctx.mcp));
      // images travel as paths inside the prompt — claude's Read tool renders image
      // files natively, no dedicated flag exists (or is needed). The user prompt rides on
      // stdin (`claude -p` reads it there when no prompt arg is given), keeping it off argv
      // for the same cmd.exe-length reason as the system prompt.
      return { args, stdin: ctx.text };
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
  // for approvals — stdin is closed right after the prompt is written, so a prompt would
  // read EOF, not hang);
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
      // `codex exec` has no system-prompt flag, so the rules ride in front of the prompt on
      // every turn, matching claude's --append-system-prompt. The whole thing goes on STDIN
      // (the `-` prompt token tells `codex exec` / `exec resume <id>` to read instructions
      // from stdin) rather than as an argv positional — on Windows the ~7KB rules overflowed
      // cmd.exe's 8191-char command line (see BuiltTurn).
      args.push('-');
      return { args, stdin: `${DCL_SYSTEM_PROMPT}\n\n---\n\n${ctx.text}` };
    },
    parseLine: (line, projectDir, emit) => {
      let obj: {
        type?: string;
        thread_id?: string;
        message?: string; // top-level `error` events (e.g. transient "Reconnecting… 401")
        item?: {
          type?: string;
          text?: string;
          message?: string; // an `error` item — codex's terminal failure for the turn
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
      // codex reports failures as `error` events (reconnect attempts) and terminal `error`
      // items — NEITHER is an agent_message, so without surfacing them a failed turn shows
      // absolutely nothing and the panel just sits there ("codex connected but won't respond").
      // Emit the text (newline-separated) so the user sees why it stalled instead of silence.
      if (obj.type === 'error' && obj.message !== undefined && obj.message !== '') {
        emit(`${obj.message}\n`);
        return undefined;
      }
      // act only on completed items (started/updated are partial and would dup)
      if (obj.type === 'item.completed' && obj.item !== undefined) {
        const item = obj.item;
        if (item.type === 'agent_message' && item.text !== undefined && item.text !== '')
          emit(item.text);
        else if (item.type === 'error' && item.message !== undefined && item.message !== '')
          emit(`${item.message}\n`);
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
  // Cursor's CLI agent (`cursor-agent`), wired against `-p --output-format stream-json`. Very
  // close to claude's shape: `session_id` from the `system`/`init` and `result` events drives
  // `--resume`; `assistant` events carry complete text blocks; `tool_call` events (started +
  // completed on one `call_id`) mark file/shell tools. Two things differ from claude/codex:
  //  - No system-prompt or rules flag, and no stdin prompt channel — so the DCL rules go in a
  //    project rule file (see prepareTurn / writeCursorRules) and the user prompt is the trailing
  //    argv positional.
  //  - `-f` (force) is the bypassPermissions/danger-full-access equivalent.
  // The CH MCP server (scene + Explorer-gateway tools) is NOT wired for Cursor yet: its only
  // channel is a project-local `.cursor/mcp.json` that would carry the bearer token in-repo, and
  // it needs live verification against a Cursor login — a follow-up. File edits work without it.
  cursor: {
    id: 'cursor',
    label: 'Cursor',
    binNames: ['cursor-agent'],
    // Documented model examples (`cursor-agent --help`: e.g. gpt-5, sonnet-4, sonnet-4-thinking).
    // `default` omits --model so Cursor uses the user's configured default.
    models: ['default', 'sonnet-4', 'sonnet-4-thinking', 'gpt-5'],
    defaultModel: 'default',
    prepareTurn: ctx => writeCursorRules(ctx.projectDir),
    buildArgs: ctx => {
      const args = [
        '-p', // non-interactive print mode (required for stream-json)
        '--output-format',
        'stream-json',
        '-f', // force-allow tool commands (bypassPermissions/danger-full-access equivalent)
      ];
      if (ctx.model !== undefined && ctx.model !== 'default') args.push('--model', ctx.model);
      if (ctx.resume !== undefined) args.push('--resume', ctx.resume);
      // No stdin prompt channel (undocumented, and the bundle reads no fd0), so the user prompt
      // is the trailing argv positional. The ~7KB DCL rules stay OFF argv (they're in the project
      // rule file), so argv length tracks only the user's own text — within cmd.exe's cap for
      // normal prompts. Image paths were appended to ctx.text by aiSend; Cursor reads them with
      // its own file tools (it has no image flag).
      args.push(ctx.text);
      return { args };
    },
    parseLine: (line, projectDir, emit) => {
      let obj: {
        type?: string;
        subtype?: string;
        session_id?: string;
        message?: { content?: Array<{ type?: string; text?: string }> };
        tool_call?: Record<string, { args?: Record<string, unknown> }>;
      };
      try {
        obj = JSON.parse(line);
      } catch {
        return undefined;
      }
      // system/init and the terminal result both report the chat id used for --resume.
      if (obj.type === 'system' && obj.subtype === 'init') return obj.session_id;
      // Each `assistant` event is a COMPLETE message segment (no --stream-partial-output). Emit
      // its text blocks; the final `result` event repeats the full text in `result`, so we DON'T
      // emit that (it would duplicate) and only read its session id.
      if (obj.type === 'assistant' && obj.message?.content !== undefined) {
        for (const block of obj.message.content) {
          if (block.type === 'text' && block.text !== undefined && block.text !== '')
            emit(block.text);
        }
      }
      // A tool call streams as a started/completed pair on one call_id — emit the chip once, on
      // `started`, to avoid a duplicate.
      if (obj.type === 'tool_call' && obj.subtype === 'started' && obj.tool_call !== undefined) {
        const chip = cursorTool(obj.tool_call, projectDir);
        if (chip !== null) emit('', chip);
      }
      if (obj.type === 'result') return obj.session_id;
      return undefined;
    },
  },
  // Google's Gemini CLI (`gemini`), wired against `-o stream-json`. Notable differences:
  //  - No login subcommand: auth is the CLI's own interactive Google sign-in or GEMINI_API_KEY
  //    (managedSignIn:false in CLI_SPECS), so the app doesn't drive sign-in — a PATH install the
  //    user already authed (or an API key) is what makes it available.
  //  - `--yolo` auto-approves every tool (bypassPermissions/danger-full-access equivalent) and
  //    `--skip-trust` trusts the workspace for the session (else Gemini skips project context).
  //  - No system-prompt flag, but `-p` is appended to stdin — so the DCL rules ride on stdin and
  //    the user prompt on `-p`, keeping the ~7KB constant off argv (Windows cmd.exe cap, #1588).
  //  - Session resume is index-based (`--resume latest|N`), which doesn't map to a stable
  //    per-conversation key, so multi-turn resume is deferred: each turn is independent for now.
  // The CH MCP scene tools are not wired for Gemini yet (same project-file/secret concern as
  // Cursor) — a follow-up; file edits work without them.
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    binNames: ['gemini'],
    models: ['default', 'gemini-3-pro', 'gemini-3-flash', 'gemini-2.5-flash'],
    defaultModel: 'default',
    buildArgs: ctx => {
      const args = [
        '-o',
        'stream-json',
        '--yolo', // auto-approve all tools (full access, matches claude/codex/cursor)
        '--skip-trust', // trust this workspace for the session so project context/tools work
      ];
      if (ctx.model !== undefined && ctx.model !== 'default') args.push('-m', ctx.model);
      // DCL rules on stdin, user prompt via -p (appended to stdin by gemini) — keeps the ~7KB
      // rules off argv. Image paths were appended to ctx.text by aiSend; gemini reads them with
      // its own file tools.
      args.push('-p', ctx.text);
      return { args, stdin: DCL_SYSTEM_PROMPT };
    },
    parseLine: (line, projectDir, emit) => {
      let obj: {
        type?: string;
        session_id?: string;
        role?: string;
        content?: string;
        message?: string;
        severity?: string;
        status?: string;
        error?: { message?: string };
        tool_name?: string;
        parameters?: Record<string, unknown>;
      };
      try {
        obj = JSON.parse(line);
      } catch {
        return undefined;
      }
      // init carries the session id + model.
      if (obj.type === 'init') return obj.session_id;
      // Assistant text arrives as `message` events with role:"assistant" (delta chunks that the
      // renderer concatenates). role:"user" is our own prompt echoed back — ignore it.
      if (obj.type === 'message' && obj.role === 'assistant' && obj.content !== undefined) {
        if (obj.content !== '') emit(obj.content);
      }
      if (obj.type === 'tool_use' && obj.tool_name !== undefined) {
        emit('', geminiTool(obj.tool_name, obj.parameters, projectDir));
      }
      // Surface errors/warnings as text so a failed turn is never silent (mirrors codex).
      if (obj.type === 'error' && obj.message !== undefined && obj.message !== '') {
        emit(`${obj.message}\n`);
      }
      if (obj.type === 'result' && obj.status === 'error' && obj.error?.message !== undefined) {
        emit(`${obj.error.message}\n`);
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
      managedSignIn: CLI_SPECS[id].managedSignIn,
      version: bin !== null ? getCliVersion(bin) : undefined,
      reason: available
        ? undefined
        : bin === null
          ? CLI_SPECS[id].managedSignIn
            ? `${def.label} not found — sign in with your subscription`
            : `${def.label} not found — install it and sign in from your terminal`
          : `${def.label} installed — finish signing in`,
    };
  });

// Cheap scan first; only pay for the login shell when something is missing — which is
// also exactly when the user presses Recheck after installing.
export async function detectProviders(): Promise<AiProviderInfo[]> {
  cachedDirs = null; // an explicit check re-reads the disk: they may have just installed
  cliVersionCache.clear(); // ...and may have just updated the CLI — re-probe its version
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
  // Unblock any `ask_user` the (about-to-die) turn is waiting on, so its MCP tool call
  // resolves as dismissed instead of hanging.
  clearPendingAsks();
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

// Spill the system prompt to a temp file so it can be passed by path (--append-system-prompt-file)
// instead of inline on argv — see BuiltTurn for why (Windows cmd.exe 8191-char command-line cap).
// The prompt is a module constant, so write it once and reuse the path (mirrors
// writeSceneMcpConfigFile). 0600 matches the project's temp-file convention — the mkdtemp dir is
// already 0700 on Unix, but Windows ACLs are looser.
let systemPromptPath: string | null = null;
function writeSystemPromptFile(text: string): string {
  if (systemPromptPath !== null) return systemPromptPath;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-hub-ai-'));
  const p = path.join(dir, 'system-prompt.txt');
  fs.writeFileSync(p, text, { mode: 0o600 });
  systemPromptPath = p;
  return p;
}

// Cursor has no system-prompt flag and no stdin prompt channel, so the DCL rules can't ride
// with the turn the way claude (--append-system-prompt-file) and codex (stdin) take them.
// Cursor's native channel is a project rule file it auto-loads, so write the rules as an
// always-applied `.cursor/rules/creator-hub.mdc`. This also keeps the ~7KB off argv (the
// Windows cmd.exe 8191-char cap BuiltTurn fights, #1588). Idempotent: rewritten only when the
// content changes, so it isn't churned every turn. Best-effort — a write failure (read-only
// project) just means no rules this turn; the caller logs and continues.
function writeCursorRules(projectDir: string): void {
  const dir = path.join(projectDir, '.cursor', 'rules');
  const file = path.join(dir, 'creator-hub.mdc');
  const body = `---\ndescription: Decentraland Creator Hub scene assistant\nalwaysApply: true\n---\n\n${DCL_SYSTEM_PROMPT}\n`;
  try {
    if (fs.readFileSync(file, 'utf8') === body) return;
  } catch {
    /* absent or unreadable — (re)write it below */
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, body);
}

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
  const turnCtx: TurnCtx = {
    text: prompt,
    model: params.model,
    projectDir,
    resume: getSessions()[projectDir]?.[sessionId]?.[params.provider],
    images,
    mcp,
  };
  // On-disk setup for a file-configured CLI (Cursor writes its rules into the project). Best-
  // effort: a failure just means a degraded turn, never a hard stop.
  try {
    def.prepareTurn?.(turnCtx);
  } catch (e) {
    log.warn(`[AI] ${def.label} prepareTurn failed:`, e);
  }
  const { args, stdin } = def.buildArgs(turnCtx);

  const env = childEnv(params.apiKeyFromEnv ?? false);
  // Codex reads the MCP bearer token from this env var (see CODEX_MCP_TOKEN_ENV); keeping it
  // out of argv. Claude gets the token via its --mcp-config file instead, so it needs nothing here.
  if (params.provider === 'codex' && mcp !== undefined) env[CODEX_MCP_TOKEN_ENV] = mcp.token;

  let child: ChildProcess;
  try {
    child = crossSpawn(bin, args, {
      cwd: projectDir,
      env,
      // The prompt/rules ride on stdin (see BuiltTurn — keeps the ~7KB off Windows' 8191-char
      // command line); pipe it when present, otherwise leave stdin closed as before.
      stdio: [stdin !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32', // own process group so killTree reaps children
    });
  } catch (e) {
    throw new Error(`failed to launch ${def.label}: ${String(e)}`);
  }

  if (stdin !== undefined && child.stdin !== null) {
    // If the child dies before draining stdin, the write races the exit and throws EPIPE — the
    // exit handler already surfaces the real failure, so that one is expected and ignored. An
    // unhandled 'error' would crash main; anything other than EPIPE is unexpected, so log it.
    child.stdin.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code !== 'EPIPE') log.warn(`[AI] stdin write error: ${err.code ?? err.message}`);
    });
    child.stdin.end(stdin);
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
      if (text !== '') emit({ kind: 'text', turnId, text: friendlyCliError(text) });
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
