// Types for the in-app AI scene assistant. The renderer chat panel and the main
// process both use these, and preload subscribes to the stream channel — so, like
// the other IPC payloads, they live in `shared/` where every layer can import them
// but main/preload cannot import each other.
//
// Phase 1: main spawns the user's own installed coding CLI (Claude Code / Codex) as
// a child process, one per turn, with the open project as its working directory. It
// runs on the user's subscription/OAuth session (API keys are stripped from the
// child env on purpose), reads the scene and writes SDK7 code under `src/`. The
// renderer only sends prompts and renders the streamed events below. The transport
// sits behind this contract so it can be swapped (e.g. for ACP) without touching the
// panel or the IPC surface.

export type AiProvider = 'claude' | 'codex';

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
}

// Streamed over the AI_STREAM_EVENT channel while a turn runs. `turnId` correlates
// events to the `ai.send` that started them. Text arrives incrementally (`text`);
// `tool` marks a file the assistant read/edited or a command it ran; `done` ends the
// turn.
export type AiEvent =
  | { kind: 'started'; turnId: string }
  | { kind: 'text'; turnId: string; text: string }
  | { kind: 'tool'; turnId: string; tool: string; detail: string }
  | { kind: 'error'; turnId: string; message: string }
  | { kind: 'done'; turnId: string; ok: boolean };
