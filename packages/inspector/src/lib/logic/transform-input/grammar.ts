/**
 * The keyboard grammar for numeric transform entry — Blender's modal transform,
 * adapted to the editor's persistent gizmo tools (#1087).
 *
 * A tool key (M/G, R, X) selects its gizmo AND arms this modal. While armed:
 *
 *   X Y Z      pick the axis            R X 1 5 ⏎  → rotate 15° about X
 *   0-9 .      build the amount         X 2 ⏎      → scale ×2 (uniform)
 *   -          toggle the sign          M Y - 3 ⏎  → move −3m on Y
 *   ⌫          erase, then drop the axis, then disarm
 *   ⏎          commit   ·   Esc  cancel
 *
 * Every other key RELEASES the modal (it disarms and the key is handled as
 * usual), so this never becomes a mode that eats the keyboard.
 *
 * Note the one asymmetry X earns by doing double duty: while armed it always
 * means "axis X", so `X X` is scale-tool-then-X-axis, not the tool's press-again
 * toggle-off. `M`/`G`/`R` release instead, so pressing those twice still toggles
 * their gizmo off exactly as before.
 */

export type TransformInputMode = 'position' | 'rotation' | 'scale';
export type TransformInputAxis = 'x' | 'y' | 'z';

export interface TransformInputState {
  mode: TransformInputMode;
  /** null until an axis is picked. Scale reads that as uniform; the others need one. */
  axis: TransformInputAxis | null;
  /** Digits and at most one decimal point, exactly as typed. Unsigned. */
  digits: string;
  negative: boolean;
}

/** What the caller should do with a key offered to the modal. */
export type TransformInputKeyResult =
  /** Consumed: adopt `state` and swallow the key. */
  | { kind: 'state'; state: TransformInputState }
  /** Consumed: apply `amount` and disarm. */
  | { kind: 'commit'; amount: number }
  /** Consumed: disarm, change nothing. */
  | { kind: 'cancel' }
  /** Not part of the grammar: disarm and let the key through untouched. */
  | { kind: 'release' };

/** Tool keys that select a gizmo and arm the modal. `G` is Blender's grab. */
export const TRANSFORM_INPUT_MODE_KEYS: Readonly<Record<string, TransformInputMode>> = {
  m: 'position',
  g: 'position',
  r: 'rotation',
  x: 'scale',
};

const AXIS_KEYS: Readonly<Record<string, TransformInputAxis>> = { x: 'x', y: 'y', z: 'z' };

const MODE_LABEL: Record<TransformInputMode, string> = {
  position: 'Move',
  rotation: 'Rotate',
  scale: 'Scale',
};

const MODE_PAST_LABEL: Record<TransformInputMode, string> = {
  position: 'Moved',
  rotation: 'Rotated',
  scale: 'Scaled',
};

export function createTransformInputState(mode: TransformInputMode): TransformInputState {
  return { mode, axis: null, digits: '', negative: false };
}

/** The signed number typed so far, or null while it isn't a usable number yet. */
export function parseTransformInputAmount(state: TransformInputState): number | null {
  if (state.digits === '') return null;
  const parsed = Number(state.digits);
  if (!Number.isFinite(parsed)) return null;
  return state.negative ? -parsed : parsed;
}

/**
 * Whether the entry is complete enough to apply. Position and rotation are
 * meaningless without an axis; scale without one is a uniform factor. A scale of
 * zero is rejected outright — it collapses the entity with no way back.
 */
export function canCommitTransformInput(state: TransformInputState): boolean {
  const amount = parseTransformInputAmount(state);
  if (amount === null) return false;
  if (state.mode === 'scale') return amount !== 0;
  return state.axis !== null;
}

export function reduceTransformInputKey(
  state: TransformInputState,
  key: string,
): TransformInputKeyResult {
  if (key === 'Escape') return { kind: 'cancel' };

  if (key === 'Enter') {
    const amount = parseTransformInputAmount(state);
    // An incomplete entry holds the modal open rather than committing a no-op or
    // disarming — the HUD is already telling the user what's missing.
    if (amount === null || !canCommitTransformInput(state)) return { kind: 'state', state };
    return { kind: 'commit', amount };
  }

  if (key === 'Backspace') {
    if (state.digits !== '') {
      return { kind: 'state', state: { ...state, digits: state.digits.slice(0, -1) } };
    }
    if (state.negative) return { kind: 'state', state: { ...state, negative: false } };
    if (state.axis !== null) return { kind: 'state', state: { ...state, axis: null } };
    return { kind: 'cancel' };
  }

  if (key === '-') return { kind: 'state', state: { ...state, negative: !state.negative } };

  const axis = AXIS_KEYS[key.toLowerCase()];
  if (axis) return { kind: 'state', state: { ...state, axis } };

  if (key >= '0' && key <= '9') {
    return { kind: 'state', state: { ...state, digits: state.digits + key } };
  }

  if (key === '.' || key === ',') {
    // A second point would make the buffer unparseable, so drop the keystroke
    // while keeping the modal armed.
    if (state.digits.includes('.')) return { kind: 'state', state };
    return { kind: 'state', state: { ...state, digits: `${state.digits || '0'}.` } };
  }

  return { kind: 'release' };
}

const UNIT: Record<TransformInputMode, string> = { position: 'm', rotation: '°', scale: '' };

/** An unset axis shows nothing — for scale the hint says it means every axis. */
function axisLabel(axis: TransformInputAxis | null): string {
  return axis ? axis.toUpperCase() : '';
}

/** The live readout while typing, e.g. `Rotate X  15°`. */
export function formatTransformInputEntry(state: TransformInputState): string {
  const sign = state.negative ? '-' : '';
  // A bare sign is worth showing — it says the entry is already negative — but the
  // unit only belongs on an actual number.
  const typed = state.digits === '' ? sign : `${sign}${state.digits}`;
  const value =
    state.digits === ''
      ? typed
      : state.mode === 'scale'
        ? `×${typed}`
        : `${typed}${UNIT[state.mode]}`;
  return [MODE_LABEL[state.mode], axisLabel(state.axis), value].filter(Boolean).join(' ');
}

/** The hint shown under the readout while the entry can't be applied yet. */
export function formatTransformInputHint(state: TransformInputState): string | null {
  if (canCommitTransformInput(state)) {
    const applies = state.mode === 'scale' && state.axis === null ? 'All axes · ' : '';
    return `${applies}Enter to apply · Esc to cancel`;
  }
  if (state.mode !== 'scale' && state.axis === null) return 'Pick an axis: X, Y or Z';
  if (state.digits === '') return 'Type a value';
  if (state.mode === 'scale' && parseTransformInputAmount(state) === 0) {
    return "Scale can't be zero";
  }
  return 'Type a value';
}

/** The confirmation toast after applying, e.g. `Rotated X by 15°`. */
export function formatTransformInputResult(
  mode: TransformInputMode,
  axis: TransformInputAxis | null,
  amount: number,
): string {
  const magnitude = mode === 'scale' ? `×${amount}` : `${amount}${UNIT[mode]}`;
  return [MODE_PAST_LABEL[mode], axisLabel(axis), 'by', magnitude].filter(Boolean).join(' ');
}
