import type { AiProvider, AiProviderInfo } from '/shared/types/ai';

// A file the assistant read/edited or a command it ran, shown as a chip in the
// transcript.
export interface AiToolChip {
  tool: string;
  detail: string;
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
}

export interface AiState {
  // Backends reported by main (Claude/Codex), with availability + reason.
  providers: AiProviderInfo[];
  // The selected backend and model. Resets the conversation when changed.
  provider: AiProvider;
  model: string;
  messages: AiMessage[];
  // A turn is running (a CLI child is streaming).
  busy: boolean;
  // A provider detection pass is in flight.
  detecting: boolean;
}
