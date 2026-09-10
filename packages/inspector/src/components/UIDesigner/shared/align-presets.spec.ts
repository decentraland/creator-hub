import { describe, expect, it } from 'vitest';

import {
  YGPT_ABSOLUTE,
  YGPT_RELATIVE,
  YGU_PERCENT,
  YGU_POINT,
  YGU_UNDEFINED,
} from '../../../lib/sdk/ui-transform-constants';
import {
  anchorPatch,
  clearedCenterMargins,
  dragPinHold,
  dragPinPatch,
  readAnchor,
} from './align-presets';

const BOX = { width: 80, height: 40 };

// The anchor patches one axis at a time; a fully pinned node is the merge of both.
const pinned = (h: Parameters<typeof anchorPatch>[0], v: Parameters<typeof anchorPatch>[0]) => ({
  ...anchorPatch(h, BOX),
  ...anchorPatch(v, BOX),
});

// A hand-authored absolute node with leading margins on both axes.
const WITH_MARGINS = {
  positionType: YGPT_ABSOLUTE,
  marginTop: 10,
  marginTopUnit: YGU_POINT,
  marginLeft: 8,
  marginLeftUnit: YGU_POINT,
};

// Where Yoga renders an absolute node's leading edges, relative to its parent's
// padding box: the authored inset plus the node's own leading margin.
const renderedOffset = (t: Record<string, unknown>) => ({
  top: (t.positionTop as number) + (t.marginTopUnit === YGU_POINT ? (t.marginTop as number) : 0),
  left:
    (t.positionLeft as number) + (t.marginLeftUnit === YGU_POINT ? (t.marginLeft as number) : 0),
});

describe('the Anchor control', () => {
  describe('when pinning an axis', () => {
    it('should pin the leading edge flush at 0px and clear the trailing one', () => {
      expect(anchorPatch('left', BOX)).toEqual({
        positionType: YGPT_ABSOLUTE,
        positionLeft: 0,
        positionLeftUnit: YGU_POINT,
        positionRight: 0,
        positionRightUnit: YGU_UNDEFINED,
        marginLeft: 0,
        marginLeftUnit: YGU_UNDEFINED,
        marginRight: 0,
        marginRightUnit: YGU_UNDEFINED,
      });
    });

    // The point of the live pin: the far edge is what gets written, so the node
    // stays glued to it while the parent resizes.
    it('should pin the trailing edge flush at 0px and clear the leading one', () => {
      expect(anchorPatch('bottom', BOX)).toEqual({
        positionType: YGPT_ABSOLUTE,
        positionBottom: 0,
        positionBottomUnit: YGU_POINT,
        positionTop: 0,
        positionTopUnit: YGU_UNDEFINED,
        marginTop: 0,
        marginTopUnit: YGU_UNDEFINED,
        marginBottom: 0,
        marginBottomUnit: YGU_UNDEFINED,
      });
    });

    it('should center with a 50% edge plus a counter-margin of half the node', () => {
      expect(anchorPatch('center', BOX)).toMatchObject({
        positionLeft: 50,
        positionLeftUnit: YGU_PERCENT,
        marginLeft: -40,
        marginLeftUnit: YGU_POINT,
      });
      expect(anchorPatch('middle', BOX)).toMatchObject({
        positionTop: 50,
        positionTopUnit: YGU_PERCENT,
        marginTop: -20,
        marginTopUnit: YGU_POINT,
      });
    });

    it('should round the counter-margin to whole pixels', () => {
      expect(anchorPatch('center', { width: 81, height: 0 })).toMatchObject({ marginLeft: -41 });
    });

    // A zero-extent axis centers with a counter-margin of -0, which serializes as
    // 0 — the read has to accept that as the idiom or the pin never comes back.
    it('should read a zero-extent axis back as centered', () => {
      expect(readAnchor(anchorPatch('middle', { width: 81, height: 0 }))).toMatchObject({
        v: 'middle',
      });
    });

    // Each dropdown owns one axis: picking Center horizontally must not disturb a
    // vertical pin that is already there.
    it('should touch only its own axis', () => {
      const keys = Object.keys(anchorPatch('center', BOX));
      expect(keys.filter(k => /Top|Bottom/.test(k))).toEqual([]);
      expect(Object.keys(anchorPatch('middle', BOX)).filter(k => /Left|Right/.test(k))).toEqual([]);
    });
  });

  describe('when reading the authored shape back', () => {
    it('should read no pin for a node that is not absolute', () => {
      expect(readAnchor(null)).toEqual({ h: null, v: null });
      expect(
        readAnchor({ positionType: YGPT_RELATIVE, positionLeft: 0, positionLeftUnit: 1 }),
      ).toEqual({ h: null, v: null });
    });

    it('should round-trip all nine pin combinations', () => {
      for (const h of ['left', 'center', 'right'] as const) {
        for (const v of ['top', 'middle', 'bottom'] as const) {
          expect(readAnchor(pinned(h, v))).toEqual({ h, v });
        }
      }
    });

    it('should report an axis with no pinned edge as null', () => {
      expect(readAnchor(anchorPatch('right', BOX))).toEqual({ h: 'right', v: null });
    });

    // Deliberate: a dragged absolute node genuinely IS pinned to its top-left, so
    // the dropdowns read Left/Top for it instead of showing nothing.
    it('should read a freehand-dragged node as top-left', () => {
      expect(readAnchor(dragPinPatch(123, 456, null))).toEqual({ h: 'left', v: 'top' });
    });

    it('should let the leading edge win when both edges are authored', () => {
      expect(
        readAnchor({
          positionType: YGPT_ABSOLUTE,
          positionLeft: 10,
          positionLeftUnit: YGU_POINT,
          positionRight: 10,
          positionRightUnit: YGU_POINT,
        }),
      ).toMatchObject({ h: 'left' });
    });

    // A percent edge alone is not the centering idiom — without the counter-margin
    // it is the node's LEFT edge at 50%, which no pin represents.
    it('should not read a percent edge without a counter-margin as centered', () => {
      expect(
        readAnchor({
          positionType: YGPT_ABSOLUTE,
          positionLeft: 50,
          positionLeftUnit: YGU_PERCENT,
        }),
      ).toEqual({ h: null, v: null });
    });
  });

  describe('when a drag commits the dropped position', () => {
    it('should write top-left px and clear the trailing edges', () => {
      expect(dragPinPatch(30, 40, pinned('left', 'top'))).toEqual({
        positionType: YGPT_ABSOLUTE,
        positionTop: 30,
        positionTopUnit: YGU_POINT,
        positionLeft: 40,
        positionLeftUnit: YGU_POINT,
        positionRight: 0,
        positionRightUnit: YGU_UNDEFINED,
        positionBottom: 0,
        positionBottomUnit: YGU_UNDEFINED,
      });
    });

    it('should clear a leading margin only where it was a centering counter-margin', () => {
      const patch = dragPinPatch(30, 40, pinned('center', 'top'));
      expect(patch).toMatchObject({ marginLeft: 0, marginLeftUnit: YGU_UNDEFINED });
      expect(Object.keys(patch).filter(k => /^marginTop/.test(k))).toEqual([]);
      // The counter-margin is going, so it must NOT also be compensated for: the
      // dropped offset is the whole inset once nothing is left to re-add.
      expect(patch.positionLeft).toBe(40);
    });

    it('should compensate for the leading margins it leaves authored', () => {
      const patch = dragPinPatch(30, 40, { ...WITH_MARGINS });
      expect(patch).toMatchObject({ positionTop: 20, positionLeft: 32 });
      expect(Object.keys(patch).filter(k => /^margin/.test(k))).toEqual([]);
    });

    // The invariant the drag exists for: after the splice round-trips, the node
    // renders exactly where it was released.
    it('should land the reparsed node on the pixel it was dropped at', () => {
      const patch = dragPinPatch(30, 40, WITH_MARGINS);
      expect(renderedOffset({ ...WITH_MARGINS, ...patch })).toEqual({ top: 30, left: 40 });
    });

    // Known ceiling: a percent margin resolves against the parent, which the patch
    // cannot measure, so it is left alone rather than subtracted as pixels.
    it('should not treat a percent leading margin as pixels', () => {
      const percent = { ...pinned('left', 'top'), marginLeft: 10, marginLeftUnit: YGU_PERCENT };
      expect(dragPinPatch(30, 40, percent)).toMatchObject({ positionLeft: 40 });
    });

    // Every patch key reaches source, and an emptied margin group deletes the
    // authored `margin` outright — so a blanket clear here would make any 1px drag
    // silently drop a hand-set margin.
    it('should leave a hand-authored margin alone', () => {
      const authored = {
        ...pinned('left', 'top'),
        marginTop: 10,
        marginTopUnit: YGU_POINT,
        marginRight: 4,
        marginRightUnit: YGU_POINT,
      };
      expect(Object.keys(dragPinPatch(30, 40, authored)).filter(k => /^margin/.test(k))).toEqual(
        [],
      );
    });

    it('should undo a centered pin, not stack a second one on top of it', () => {
      const centered = pinned('center', 'middle');
      expect(readAnchor({ ...centered, ...dragPinPatch(5, 6, centered) })).toEqual({
        h: 'left',
        v: 'top',
      });
    });
  });

  describe('when holding the dropped frame until the splice lands', () => {
    // The held frame and the reparsed frame have to be the same pixel, or releasing
    // the hold shows a one-frame jump — the only reason the hold exists.
    it('should hold the committed inset and let a surviving margin keep rendering', () => {
      const hold = dragPinHold(30, 40, WITH_MARGINS);
      expect(hold).toEqual({ top: 20, left: 32, marginTop: undefined, marginLeft: undefined });
      expect(
        renderedOffset({ ...WITH_MARGINS, positionTop: hold.top, positionLeft: hold.left }),
      ).toEqual({ top: 30, left: 40 });
    });

    it('should zero the counter-margins the commit clears', () => {
      expect(dragPinHold(5, 6, pinned('center', 'middle'))).toEqual({
        top: 5,
        left: 6,
        marginTop: 0,
        marginLeft: 0,
      });
    });
  });

  describe('when the node leaves the anchor behind', () => {
    it('should clear only the counter-margins a centered pin owns', () => {
      expect(clearedCenterMargins(pinned('center', 'middle'))).toEqual({
        marginLeft: 0,
        marginLeftUnit: YGU_UNDEFINED,
        marginTop: 0,
        marginTopUnit: YGU_UNDEFINED,
      });
      expect(clearedCenterMargins(pinned('center', 'bottom'))).toEqual({
        marginLeft: 0,
        marginLeftUnit: YGU_UNDEFINED,
      });
    });

    it('should leave a hand-authored margin on an unpinned node alone', () => {
      expect(clearedCenterMargins({ marginLeft: 12, marginLeftUnit: YGU_POINT })).toEqual({});
      expect(clearedCenterMargins(pinned('left', 'top'))).toEqual({});
    });
  });
});
