import { describe, expect, it } from 'vitest';

import {
  type Alignment,
  ALIGNMENTS,
  alignmentToPatch,
  clearAlignmentPatch,
  patchToAlignment,
} from './alignment-presets';

const ROW = 0;
const COLUMN = 1;
const COLUMN_REVERSE = 2;
const ROW_REVERSE = 3;
const ALL_DIRECTIONS = [ROW, COLUMN, COLUMN_REVERSE, ROW_REVERSE];

const JUSTIFY_START = 0;
const JUSTIFY_CENTER = 1;
const JUSTIFY_END = 2;
const JUSTIFY_SPACE_BETWEEN = 3;
const ALIGN_AUTO = 0;
const ALIGN_START = 1;
const ALIGN_END = 3;
const ALIGN_STRETCH = 4;

describe('alignment presets', () => {
  describe('when writing a cell and reading it back', () => {
    it('should round-trip all 9 cells in all 4 flex directions', () => {
      for (const direction of ALL_DIRECTIONS) {
        for (const alignment of ALIGNMENTS) {
          const patch = alignmentToPatch(alignment, direction);
          expect(patchToAlignment(patch, direction), `${alignment} @ ${direction}`).toBe(alignment);
        }
      }
    });

    it('should always write both props, never one', () => {
      for (const direction of ALL_DIRECTIONS) {
        for (const alignment of ALIGNMENTS) {
          expect(Object.keys(alignmentToPatch(alignment, direction)).sort()).toEqual([
            'alignItems',
            'justifyContent',
          ]);
        }
      }
    });
  });

  describe('and the flex direction decides which prop owns which screen axis', () => {
    it('should put the horizontal position on justifyContent for a row', () => {
      expect(alignmentToPatch('top-right', ROW)).toEqual({
        justifyContent: JUSTIFY_END,
        alignItems: ALIGN_START,
      });
    });

    it('should put the vertical position on justifyContent for a column', () => {
      expect(alignmentToPatch('top-right', COLUMN)).toEqual({
        justifyContent: JUSTIFY_START,
        alignItems: ALIGN_END,
      });
    });

    it('should flip start and end on a reversed main axis', () => {
      expect(alignmentToPatch('top-left', ROW_REVERSE)).toEqual({
        justifyContent: JUSTIFY_END,
        alignItems: ALIGN_START,
      });
      expect(alignmentToPatch('top-left', COLUMN_REVERSE)).toEqual({
        justifyContent: JUSTIFY_END,
        alignItems: ALIGN_START,
      });
    });

    it('should read the same pair as a different cell per direction', () => {
      const pair = { justifyContent: JUSTIFY_END, alignItems: ALIGN_START };
      expect(patchToAlignment(pair, ROW)).toBe('top-right');
      expect(patchToAlignment(pair, COLUMN)).toBe('bottom-left');
    });

    it('should centre in both axes regardless of direction', () => {
      for (const direction of ALL_DIRECTIONS) {
        expect(alignmentToPatch('middle-center', direction)).toEqual({
          justifyContent: JUSTIFY_CENTER,
          alignItems: 2,
        });
      }
    });
  });

  describe('and the state sits outside the 9 cells', () => {
    it('should report no cell when either prop is unauthored', () => {
      expect(patchToAlignment({ justifyContent: JUSTIFY_START }, ROW)).toBeNull();
      expect(patchToAlignment({ alignItems: ALIGN_START }, ROW)).toBeNull();
      expect(patchToAlignment({}, ROW)).toBeNull();
      expect(patchToAlignment(null, ROW)).toBeNull();
    });

    it('should report no cell for a distributing justifyContent', () => {
      expect(
        patchToAlignment({ justifyContent: JUSTIFY_SPACE_BETWEEN, alignItems: ALIGN_START }, ROW),
      ).toBeNull();
    });

    it('should report no cell for auto or stretch alignItems', () => {
      for (const align of [ALIGN_AUTO, ALIGN_STRETCH]) {
        expect(
          patchToAlignment({ justifyContent: JUSTIFY_START, alignItems: align }, ROW),
        ).toBeNull();
      }
    });

    it('should clear both props for the Default option', () => {
      expect(clearAlignmentPatch()).toEqual({ justifyContent: undefined, alignItems: undefined });
    });
  });

  it('should list the 9 cells row-major, which is the dropdown order', () => {
    expect(ALIGNMENTS).toEqual<Alignment[]>([
      'top-left',
      'top-center',
      'top-right',
      'middle-left',
      'middle-center',
      'middle-right',
      'bottom-left',
      'bottom-center',
      'bottom-right',
    ]);
  });
});
