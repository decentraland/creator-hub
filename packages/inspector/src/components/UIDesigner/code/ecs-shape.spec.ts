import { describe, expect, it } from 'vitest';

import {
  ergonomicToPBText,
  ergonomicToPBTransform,
  pbToErgonomicText,
  pbToErgonomicTransform,
} from './ecs-shape';

// The enum-prop values below are the PBUiTransform enums (@dcl/ecs
// ui_transform.gen); the ergonomic strings are react-ecs's own parser keys
// (@dcl/react-ecs uiTransform utils parse* maps). Both are asserted here so a
// drift in either the shape layer or the field-config enum ordering fails fast.
describe('when converting react-ecs uiTransform enum props to PB', () => {
  it('should map flex/layout enum strings to their PB numeric enum', () => {
    const pb = ergonomicToPBTransform({
      display: 'none',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
      alignContent: 'flex-end',
      alignSelf: 'stretch',
      flexWrap: 'wrap',
      overflow: 'scroll',
    });
    expect(pb).toMatchObject({
      display: 1,
      flexDirection: 1,
      justifyContent: 3,
      alignItems: 2,
      alignContent: 3,
      alignSelf: 4,
      flexWrap: 1,
      overflow: 2,
    });
  });

  it('should map the react-ecs "row" flexDirection to enum 0 (not Yoga column)', () => {
    expect(ergonomicToPBTransform({ flexDirection: 'row' }).flexDirection).toBe(0);
  });

  it('should drop an unrecognized enum string rather than emit a bogus number', () => {
    const pb = ergonomicToPBTransform({ flexDirection: 'sideways' as unknown as string });
    expect(pb.flexDirection).toBeUndefined();
  });
});

describe('when converting PB enum props back to react-ecs strings', () => {
  it('should map PB numeric enums back to react-ecs parser strings', () => {
    const ergo = pbToErgonomicTransform({
      display: 1,
      flexDirection: 2,
      justifyContent: 5,
      alignItems: 4,
      flexWrap: 0,
      overflow: 1,
    });
    expect(ergo).toMatchObject({
      display: 'none',
      flexDirection: 'column-reverse',
      justifyContent: 'space-evenly',
      alignItems: 'stretch',
      // YGWrap 0 must serialize as react-ecs's 'nowrap' (no hyphen), else the
      // runtime parser drops it.
      flexWrap: 'nowrap',
      overflow: 'hidden',
    });
  });

  it('should not inject an enum prop that was never present in the PB', () => {
    const ergo = pbToErgonomicTransform({ width: 100, widthUnit: 1 });
    expect(ergo.flexDirection).toBeUndefined();
    expect(ergo.justifyContent).toBeUndefined();
    expect(ergo.display).toBeUndefined();
  });
});

describe('when round-tripping every enum prop through PB and back', () => {
  it('should preserve each field-config option value', () => {
    const ergo = {
      display: 'flex',
      flexDirection: 'row-reverse',
      justifyContent: 'center',
      alignItems: 'baseline',
      alignContent: 'space-around',
      alignSelf: 'flex-start',
      flexWrap: 'wrap-reverse',
      overflow: 'visible',
    };
    expect(pbToErgonomicTransform(ergonomicToPBTransform(ergo))).toMatchObject(ergo);
  });
});

describe('when converting Label text enum props', () => {
  it('should map textAlign / font strings to their PB numeric enum', () => {
    expect(ergonomicToPBText({ textAlign: 'middle-center', font: 'serif' })).toEqual({
      textAlign: 4,
      font: 1,
    });
  });

  it('should map PB textAlign / font numbers back to react-ecs strings', () => {
    expect(pbToErgonomicText({ textAlign: 8, font: 2 })).toEqual({
      textAlign: 'bottom-right',
      font: 'monospace',
    });
  });

  it('should pass value / fontSize / color through unchanged', () => {
    const ergo = { value: 'Hi', fontSize: 24, color: { r: 1, g: 0, b: 0 } };
    expect(ergonomicToPBText(ergo)).toEqual(ergo);
    expect(pbToErgonomicText(ergo)).toEqual(ergo);
  });

  it('should drop an unrecognized enum rather than emit a bogus value', () => {
    expect(ergonomicToPBText({ textAlign: 'diagonal' }).textAlign).toBeUndefined();
    expect(pbToErgonomicText({ textAlign: 99 }).textAlign).toBeUndefined();
  });

  it('should round-trip textAlign / font through PB and back', () => {
    const ergo = { textAlign: 'top-right', font: 'sans-serif' };
    expect(pbToErgonomicText(ergonomicToPBText(ergo))).toEqual(ergo);
  });
});
