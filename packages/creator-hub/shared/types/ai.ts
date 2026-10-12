// Types for the in-app AI scene assistant. The renderer chat panel and the main
// process both use these, and preload subscribes to the stream channel — so, like
// the other IPC payloads, they live in `shared/` where every layer can import them
// but main/preload cannot import each other.
//
// Phase 1: main spawns the user's own installed coding CLI (Claude Code / Codex / Cursor /
// Gemini) as a child process, one per turn, with the open project as its working directory. It
// runs on the user's subscription/OAuth session (API keys are stripped from the
// child env on purpose), reads the scene and writes SDK7 code under `src/`. The
// renderer only sends prompts and renders the streamed events below. The transport
// sits behind this contract so it can be swapped (e.g. for ACP) without touching the
// panel or the IPC surface.

export type AiProvider = 'claude' | 'codex' | 'cursor' | 'gemini';

// One selectable backend, as reported to the chat UI. `available` is false when the
// CLI binary isn't installed (or, best-effort, isn't logged in) — the UI disables it
// and shows `reason`.
export interface AiProviderInfo {
  id: AiProvider;
  label: string;
  available: boolean;
  models: string[];
  defaultModel: string;
  reason?: string;
  // The installed CLI's version (e.g. "2.1.260"), best-effort from `<bin> --version`.
  // Absent when the binary isn't found or didn't report a parseable version. Used to
  // warn when the CLI is too old for the newest models (see isClaudeCliOutdated).
  version?: string;
  /** Whether the app signs this CLI in and out: the vendor allows it and no terminal install is in use. */
  managedSignIn: boolean;
  desktopInstalled?: boolean;
  needsLogin?: boolean;
}

// Newest Claude models (e.g. Fable) are gated on the CLI version: an older `claude`
// rejects them with a `claude_code_version_too_old` API error. This is the floor the
// UI nudges users up to. Bump it as newer models raise the requirement.
export const MIN_CLAUDE_CLI_VERSION = '2.1.251';

type CliCommands = {
  install: string;
  installWindows?: string;
  signin: string;
  relogin: string[];
  guideUrl: string;
  guideAnchors?: { windows: string; unix: string };
};

export const AI_CLI_COMMANDS: Record<AiProvider, CliCommands> = {
  claude: {
    install: 'curl -fsSL https://claude.ai/install.sh | bash',
    installWindows: 'winget install Anthropic.ClaudeCode',
    signin: 'claude auth login',
    relogin: ['claude auth logout', 'claude auth login'],
    guideUrl: 'https://code.claude.com/docs/en/terminal-guide',
    guideAnchors: { windows: '#windows', unix: '#macos-and-linux' },
  },
  codex: {
    install: 'curl -fsSL https://chatgpt.com/codex/install.sh | sh',
    installWindows:
      'powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"',
    signin: 'codex login',
    relogin: ['codex logout', 'codex login'],
    guideUrl: 'https://developers.openai.com/codex/cli',
  },
  cursor: {
    install: 'curl https://cursor.com/install -fsS | bash',
    installWindows:
      'powershell -ExecutionPolicy ByPass -c "irm \'https://cursor.com/install?win32=true\' | iex"',
    signin: 'cursor-agent login',
    relogin: ['cursor-agent logout', 'cursor-agent login'],
    guideUrl: 'https://cursor.com/docs/cli/installation',
  },
  gemini: {
    install: 'npm install -g @google/gemini-cli',
    signin: 'gemini',
    relogin: ['gemini', '/auth logout', '/auth login'],
    guideUrl: 'https://www.geminicli.com/docs/get-started/installation',
  },
};

/** The terminal install command, sign-in command, sign-out-then-in steps and install-guide link for this OS. */
export function cliSetup(
  provider: AiProvider,
  windows: boolean,
): { install: string; signin: string; relogin: string[]; guideUrl: string } {
  const cmds = AI_CLI_COMMANDS[provider];
  const anchor = cmds.guideAnchors?.[windows ? 'windows' : 'unix'] ?? '';
  return {
    install: (windows ? cmds.installWindows : undefined) ?? cmds.install,
    signin: cmds.signin,
    relogin: cmds.relogin,
    guideUrl: cmds.guideUrl + anchor,
  };
}

// True when `version` is a parseable semver strictly older than `min`. Unknown/absent
// versions are treated as NOT outdated — we never nag when we couldn't read the version.
export function isCliVersionOutdated(version: string | undefined, min: string): boolean {
  if (version === undefined) return false;
  const parse = (v: string): number[] | null => {
    const m = v.match(/(\d+)\.(\d+)\.(\d+)/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const a = parse(version);
  const b = parse(min);
  if (a === null || b === null) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}

// A file the user attached to a prompt — an image, a 3D model, audio, or any other file.
// How it reaches the CLI depends on where it came from:
//   • Dropped/picked from disk → `path` (its real absolute path). Handed to the CLI as-is:
//     no copy, no base64 round-trip, no size cap. Claude reads images with its Read tool and
//     references models/audio/etc. by path when writing scene code; codex takes images via -i.
//   • Pasted from the clipboard (no file on disk) → `dataUrl`. Main writes it to a temp file
//     and hands over that path instead.
// Exactly one of `path` / `dataUrl` is set. `kind` classifies it for the UI and for codex's
// image-only -i flag; `mimeType` is best-effort (absent for some dropped files).
export type AiAttachmentKind = 'image' | 'model' | 'audio' | 'file';

export interface AiAttachment {
  name: string;
  kind: AiAttachmentKind;
  mimeType?: string;
  path?: string;
  dataUrl?: string;
}

// The subset of an attachment kept on a persisted user message, for the transcript's chips —
// just enough to label it. The bytes/paths themselves aren't stored in the transcript.
export interface AiAttachmentMeta {
  name: string;
  kind: AiAttachmentKind;
}

// A single user turn to run. `text` is the prompt the user typed; `context` is editor
// state the assistant should see but the user shouldn't have to retype — it's
// prepended to the prompt, not shown in the chat bubble. The main process keeps the
// per-provider session id and resumes it, so turns chain into one conversation until
// `ai.reset`.
export interface AiSendParams {
  provider: AiProvider;
  model?: string;
  text: string;
  context?: string;
  attachments?: AiAttachment[];
  // When true, the assistant keeps the API key in its environment (bill via API key) instead
  // of stripping it to force subscription billing. From the `useApiKeyFromEnv` setting.
  apiKeyFromEnv?: boolean;
  // Which local session this turn belongs to. Main keys the provider resume id by
  // (projectDir, sessionId), so each saved conversation resumes its own CLI thread.
  sessionId?: string;
}

// Streamed over the AI_STREAM_EVENT channel while a turn runs. `turnId` correlates
// events to the `ai.send` that started them. Text arrives incrementally (`text`);
// `tool` marks a file the assistant read/edited or a command it ran; `done` ends the
// turn.
export type AiEvent =
  | { kind: 'started'; turnId: string }
  | { kind: 'text'; turnId: string; text: string }
  | { kind: 'tool'; turnId: string; tool: string; detail: string }
  // An image an MCP tool returned (Explorer/editor screenshot), as a data URL — shown
  // inline in the transcript (#1506).
  | { kind: 'image'; turnId: string; dataUrl: string }
  | { kind: 'error'; turnId: string; message: string }
  // `mutations` is how many undo entries this turn applied to the scene graph — the panel
  // uses it to offer a one-click "Undo AI changes" (revert the turn).
  | { kind: 'done'; turnId: string; ok: boolean; mutations?: number };

// --- Detached AI window (#1504) -------------------------------------------------------
//
// The chat can be popped out into a separate OS window. To avoid a second, forked copy
// of the chat state, the detached window keeps NO store of its own: the main window
// stays the single source of truth and mirrors its `ai` slice to the detached window
// (AiMirrorState), which renders it and sends user actions back (AiRemoteCommand). Both
// hops are relayed through the main process, since two renderers can't talk directly.
// These payloads must stay plain-serializable for IPC.

// An interactive `ask_user` question, rendered in the transcript. The turn blocks until
// `answer` is set (or `dismissed` on stop). Ephemeral — stripped before a transcript persists.
export interface AiPromptData {
  id: string;
  question: string;
  options: { label: string; description?: string }[];
  multiSelect: boolean;
  allowOther: boolean;
  answer?: string;
  dismissed?: boolean;
}

// One ordered piece of an assistant turn, rendered in the exact order it arrived so text,
// tool chips, screenshots and interactive prompts stay chronological (#1573).
export type AiPart =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; tool: string; detail: string }
  | { kind: 'image'; dataUrl: string }
  | { kind: 'prompt'; prompt: AiPromptData };

export interface AiMirrorMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: AiPart[];
  done: boolean;
  error?: string;
  mutations?: number;
  reverted?: boolean;
  // Files the user attached to this prompt (chips under the user bubble). Name + kind only.
  attachments?: AiAttachmentMeta[];
}

export interface AiMirrorState {
  providers: AiProviderInfo[];
  provider: AiProvider;
  model: string;
  messages: AiMirrorMessage[];
  busy: boolean;
  detecting: boolean;
  selection: { id: number; name: string }[];
  billingDismissed: boolean;
  sessions: { id: string; title: string; updatedAt: number }[];
  currentSessionId: string;
  // The open project's title, for the detached window's header (it has no editor of its own).
  projectTitle?: string;
}

// A user action taken in the detached window, forwarded to the main window to run against
// the single store. `sync` asks the main window to push the current state (on mount).
export type AiRemoteCommand =
  | { type: 'send'; text: string; attachments?: AiAttachment[] }
  | { type: 'stop' }
  | { type: 'newChat' }
  | { type: 'setProvider'; provider: AiProvider }
  | { type: 'revertTurn'; id: string; count: number }
  | { type: 'answerPrompt'; id: string; answer: string }
  | { type: 'fetchProviders' }
  | { type: 'dismissBilling' }
  | { type: 'switchSession'; id: string }
  | { type: 'deleteSession'; id: string }
  | { type: 'clearSelection' }
  // The detached window's close button: shut the assistant entirely (close the window AND the
  // inline panel), instead of just docking back — so close is consistent whether detached or not.
  | { type: 'closeAssistant' }
  | { type: 'sync' };
