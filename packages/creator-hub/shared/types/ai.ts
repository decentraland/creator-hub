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
  // Whether the app can drive this CLI's sign-in itself (install-on-demand + scripted OAuth).
  // False for a CLI with no scriptable login (Gemini authenticates from its own interactive CLI
  // or an API-key env var), so the UI shows the terminal command instead of an in-app button.
  managedSignIn: boolean;
}

// Newest Claude models (e.g. Fable) are gated on the CLI version: an older `claude`
// rejects them with a `claude_code_version_too_old` API error. This is the floor the
// UI nudges users up to. Bump it as newer models raise the requirement.
export const MIN_CLAUDE_CLI_VERSION = '2.1.251';

// Install + sign-in commands per agent, shown on the chat setup card and the settings
// "Connect" section. Obviously-safe public package names.
export const AI_CLI_COMMANDS: Record<AiProvider, { install: string; signin: string }> = {
  claude: { install: 'npm i -g @anthropic-ai/claude-code', signin: 'claude' },
  codex: { install: 'npm i -g @openai/codex', signin: 'codex login' },
  cursor: { install: 'npm i -g cursor-agent', signin: 'cursor-agent login' },
  gemini: { install: 'npm i -g @google/gemini-cli', signin: 'gemini' },
};

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

// Pasted/attached images, as data URLs. Main writes them to temp files and hands the
// CLI paths (claude reads them with its Read tool; codex takes -i).
export interface AiImageAttachment {
  name: string;
  dataUrl: string;
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
  images?: AiImageAttachment[];
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
  | { type: 'send'; text: string }
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
