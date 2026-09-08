import type { AiProvider, AiProviderInfo } from '/shared/types/ai';

// A file the assistant read/edited or a command it ran, shown as a chip in the
// transcript.
export interface AiToolChip {
  tool: string;
  detail: string;
}

// An interactive question the assistant posed via the `ask_user` tool, rendered in the
// transcript. The turn blocks until `answer` is set (or `dismissed` on stop). Ephemeral —
// stripped before a transcript is persisted.
export interface AiPromptData {
  id: string;
  question: string;
  options: { label: string; description?: string }[];
  multiSelect: boolean;
  allowOther: boolean;
  answer?: string; // set once the user answers
  dismissed?: boolean; // turn stopped / timed out before an answer
}

// One bubble in the transcript. Assistant messages are keyed by their turnId so the
// event stream can find and append to them; user messages get a local id.
export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  tools: AiToolChip[];
  done: boolean;
  error?: string;
  // An interactive `ask_user` prompt carried by this (assistant) message.
  prompt?: AiPromptData;
  // How many undo steps this turn applied to the scene graph (from the `done` event).
  // Drives the one-click "Undo AI changes" affordance.
  mutations?: number;
  // Set once the user reverts this turn's scene changes, so the button hides.
  reverted?: boolean;
  // Images an MCP tool returned this turn (Explorer/editor screenshots), as data URLs,
  // shown inline in the bubble (#1506). Not persisted — they're large and ephemeral.
  images?: string[];
}

// One saved conversation for a scene, shown in the history picker. `title` is the first
// user prompt (empty for a brand-new, not-yet-used session — rendered as "New chat").
export interface AiSessionMeta {
  id: string;
  title: string;
  updatedAt: number; // epoch ms; the list is sorted newest first
}

export interface AiState {
  // Backends reported by main (Claude/Codex), with availability + reason.
  providers: AiProviderInfo[];
  // The selected backend and model. Resets the conversation when changed.
  provider: AiProvider;
  // True once the user explicitly picked a provider from the dropdown. While pinned, a
  // re-detection won't auto-switch away from it — otherwise picking a not-yet-signed-in
  // agent to sign into would bounce back to an available one the moment detection reran.
  providerPinned: boolean;
  model: string;
  messages: AiMessage[];
  // A turn is running (a CLI child is streaming).
  busy: boolean;
  // A provider detection pass is in flight.
  detecting: boolean;
  // The user dismissed the "runs on your own account" billing hint for the open scene
  // (#1505). Persisted per-project; loaded with the conversation.
  billingDismissed: boolean;
  // The scene's saved conversations (newest first) and which one is active. `messages`
  // above is the active session's transcript.
  sessions: AiSessionMeta[];
  currentSessionId: string;
  // The entities the user currently has selected in the editor (polled from the inspector
  // while the panel is open). Shown as a composer chip and prepended to the turn as context
  // so the assistant can resolve "this" / "the selected entity".
  selection: { id: number; name: string }[];
}
