export type EntityRef = { id: number; name?: string };

/**
 * One thing the user did while the host was recording a session. The host defines an
 * identical type and merges these with the transcribed speech into a single timeline, so
 * `text` must make sense to an LLM on its own.
 */
export type RecordedEvent = {
  /** `Date.now()` when it happened (epoch ms), so it lines up with the host's clock. */
  t: number;
  kind: string;
  /** One human-readable line, at most {@link MAX_TEXT_LENGTH} characters. */
  text: string;
  entity?: EntityRef;
  area?: string;
  /** Pointer position in CSS px of the inspector document, for pointer events. */
  x?: number;
  y?: number;
};

export type RecordedEventInput = Omit<RecordedEvent, 't'> & { t?: number };

export type Emit = (event: RecordedEventInput) => void;

/** Stops a tracker: detaches everything it attached and emits whatever it was still holding. */
export type StopTracker = () => void;

export const MAX_TEXT_LENGTH = 200;
