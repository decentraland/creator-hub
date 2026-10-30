import { describe, expect, it } from 'vitest';

import type { TransformInputState } from './grammar';
import {
  canCommitTransformInput,
  createTransformInputState,
  formatTransformInputEntry,
  formatTransformInputHint,
  formatTransformInputResult,
  parseTransformInputAmount,
  reduceTransformInputKey,
  TRANSFORM_INPUT_MODE_KEYS,
} from './grammar';

/** Feed a key sequence through the reducer, returning the last outcome. */
function type(state: TransformInputState, keys: string[]) {
  let current = state;
  let last = reduceTransformInputKey(current, keys[0]);
  for (const key of keys) {
    last = reduceTransformInputKey(current, key);
    if (last.kind === 'state') current = last.state;
  }
  return { state: current, last };
}

describe('when mapping a tool key to a mode', () => {
  it('should map M and G to position, R to rotation and X to scale', () => {
    expect(TRANSFORM_INPUT_MODE_KEYS.m).toBe('position');
    expect(TRANSFORM_INPUT_MODE_KEYS.g).toBe('position');
    expect(TRANSFORM_INPUT_MODE_KEYS.r).toBe('rotation');
    expect(TRANSFORM_INPUT_MODE_KEYS.x).toBe('scale');
  });
});

describe("when typing the issue's own example, R X 1 5 Enter", () => {
  it('should commit 15 degrees about X', () => {
    const { last } = type(createTransformInputState('rotation'), ['x', '1', '5', 'Enter']);
    expect(last).toEqual({ kind: 'commit', amount: 15 });
  });
});

describe('when an axis key is pressed while armed', () => {
  it('should set the axis rather than release, so X is the axis and not the scale tool', () => {
    const result = reduceTransformInputKey(createTransformInputState('scale'), 'x');
    expect(result).toEqual({ kind: 'state', state: expect.objectContaining({ axis: 'x' }) });
  });

  it('should accept an uppercase axis (a shifted keystroke)', () => {
    const result = reduceTransformInputKey(createTransformInputState('rotation'), 'Z');
    expect(result).toEqual({ kind: 'state', state: expect.objectContaining({ axis: 'z' }) });
  });
});

describe('when building the amount', () => {
  it('should parse a decimal', () => {
    const { state } = type(createTransformInputState('position'), ['y', '2', '.', '5']);
    expect(parseTransformInputAmount(state)).toBe(2.5);
  });

  it('should treat a comma as a decimal point', () => {
    const { state } = type(createTransformInputState('position'), ['y', '2', ',', '5']);
    expect(parseTransformInputAmount(state)).toBe(2.5);
  });

  it('should keep the buffer parseable by dropping a second decimal point', () => {
    const { state } = type(createTransformInputState('position'), ['y', '2', '.', '5', '.', '1']);
    expect(parseTransformInputAmount(state)).toBe(2.51);
  });

  it('should seed a leading zero when the point comes first', () => {
    const { state } = type(createTransformInputState('position'), ['y', '.', '5']);
    expect(parseTransformInputAmount(state)).toBe(0.5);
  });

  it('should toggle the sign with -', () => {
    const { state } = type(createTransformInputState('position'), ['y', '3', '-']);
    expect(parseTransformInputAmount(state)).toBe(-3);
    expect(parseTransformInputAmount(type(state, ['-']).state)).toBe(3);
  });

  it('should be null before any digit is typed', () => {
    expect(parseTransformInputAmount(createTransformInputState('scale'))).toBeNull();
  });
});

describe('when deciding whether an entry can be applied', () => {
  it('should require an axis for position and rotation', () => {
    const { state } = type(createTransformInputState('position'), ['4']);
    expect(canCommitTransformInput(state)).toBe(false);
    expect(canCommitTransformInput(type(state, ['x']).state)).toBe(true);
  });

  it('should treat scale without an axis as a uniform factor', () => {
    const { state } = type(createTransformInputState('scale'), ['2']);
    expect(canCommitTransformInput(state)).toBe(true);
  });

  it('should reject a zero scale, which no later edit could undo', () => {
    const { state } = type(createTransformInputState('scale'), ['0']);
    expect(canCommitTransformInput(state)).toBe(false);
  });

  it('should allow a zero move, which is merely a no-op', () => {
    const { state } = type(createTransformInputState('position'), ['x', '0']);
    expect(canCommitTransformInput(state)).toBe(true);
  });
});

describe('when Enter arrives on an incomplete entry', () => {
  it('should hold the modal open instead of committing or cancelling', () => {
    const state = createTransformInputState('rotation');
    expect(reduceTransformInputKey(state, 'Enter')).toEqual({ kind: 'state', state });
  });
});

describe('when Backspace is pressed', () => {
  it('should erase the digits, then the sign, then the axis, then cancel', () => {
    const { state } = type(createTransformInputState('rotation'), ['x', '1', '-']);
    const noSign = reduceTransformInputKey(state, 'Backspace');
    expect(noSign).toEqual({ kind: 'state', state: expect.objectContaining({ digits: '' }) });

    const afterDigits = (noSign as { state: TransformInputState }).state;
    const noNegative = reduceTransformInputKey(afterDigits, 'Backspace');
    expect(noNegative).toEqual({
      kind: 'state',
      state: expect.objectContaining({ negative: false, axis: 'x' }),
    });

    const beforeAxis = (noNegative as { state: TransformInputState }).state;
    const noAxis = reduceTransformInputKey(beforeAxis, 'Backspace');
    expect(noAxis).toEqual({ kind: 'state', state: expect.objectContaining({ axis: null }) });

    const empty = (noAxis as { state: TransformInputState }).state;
    expect(reduceTransformInputKey(empty, 'Backspace')).toEqual({ kind: 'cancel' });
  });
});

describe('when Escape is pressed', () => {
  it('should cancel from any point in the entry', () => {
    const { state } = type(createTransformInputState('scale'), ['x', '2']);
    expect(reduceTransformInputKey(state, 'Escape')).toEqual({ kind: 'cancel' });
  });
});

describe('when a key outside the grammar arrives', () => {
  it.each(['w', 'f', 'r', 'g', 'm', 'Tab', 'ArrowUp'])('should release %s', key => {
    expect(reduceTransformInputKey(createTransformInputState('rotation'), key)).toEqual({
      kind: 'release',
    });
  });
});

describe('when rendering the readout', () => {
  it('should show the mode, axis and value as typed', () => {
    const { state } = type(createTransformInputState('rotation'), ['x', '1', '5']);
    expect(formatTransformInputEntry(state)).toBe('Rotate X 15°');
  });

  it('should show scale as a multiplier, with no axis shown when it is uniform', () => {
    const { state } = type(createTransformInputState('scale'), ['2']);
    expect(formatTransformInputEntry(state)).toBe('Scale ×2');
  });

  it('should show the mode alone before anything is typed', () => {
    expect(formatTransformInputEntry(createTransformInputState('position'))).toBe('Move');
  });

  it('should name what is missing in the hint', () => {
    expect(formatTransformInputHint(createTransformInputState('position'))).toBe(
      'Pick an axis: X, Y or Z',
    );
    const { state } = type(createTransformInputState('position'), ['x']);
    expect(formatTransformInputHint(state)).toBe('Type a value');
    expect(formatTransformInputHint(type(state, ['4']).state)).toBe(
      'Enter to apply · Esc to cancel',
    );
  });

  it('should explain a rejected zero scale', () => {
    const { state } = type(createTransformInputState('scale'), ['0']);
    expect(formatTransformInputHint(state)).toBe("Scale can't be zero");
  });

  it('should report what was applied', () => {
    expect(formatTransformInputResult('rotation', 'x', 15)).toBe('Rotated X by 15°');
    expect(formatTransformInputResult('position', 'y', -3)).toBe('Moved Y by -3m');
    expect(formatTransformInputResult('scale', null, 2)).toBe('Scaled by ×2');
  });
});
