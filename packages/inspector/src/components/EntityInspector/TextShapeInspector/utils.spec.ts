import type { PBTextShape } from '@dcl/ecs';
import { Font, TextAlignMode } from '@dcl/ecs';
import { fromTextShape, toTextShape, isValidInput } from './utils';
import type { TextShapeInput } from './types';

describe('fromTextShape', () => {
  it('should convert PBTextShape to TextShapeInput', () => {
    const pbTextShape: PBTextShape = {
      text: 'Hello, World!',
      font: Font.F_SANS_SERIF,
      fontSize: 16,
      fontAutoSize: true,
      textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
      width: 2,
      height: 3,
      paddingTop: 10,
      paddingRight: 20,
      paddingBottom: 15,
      paddingLeft: 5,
      outlineWidth: 1,
      lineSpacing: 200,
      lineCount: 3,
      textWrapping: true,
      shadowBlur: 4,
      shadowOffsetX: 5,
      shadowOffsetY: -6,
      shadowColor: { r: 0, g: 1, b: 0 },
      outlineColor: { r: 1, b: 0, g: 0 },
      textColor: { r: 1, b: 0, g: 0, a: 1 },
    };

    const result: TextShapeInput = fromTextShape(pbTextShape);

    expect(result).toEqual({
      text: 'Hello, World!',
      font: Font.F_SANS_SERIF.toString(),
      fontSize: '16',
      fontAutoSize: true,
      textAlign: TextAlignMode.TAM_MIDDLE_CENTER.toString(),
      width: '2',
      height: '3',
      paddingTop: '10',
      paddingRight: '20',
      paddingBottom: '15',
      paddingLeft: '5',
      outlineWidth: '5',
      lineSpacing: '2',
      lineCount: '3',
      textWrapping: true,
      shadowBlur: '4',
      shadowOffsetX: '5',
      shadowOffsetY: '-6',
      shadowColor: '#00FF00',
      outlineColor: '#FF0000',
      textColor: '#FF0000',
      textColorAlpha: '1',
    });
  });

  describe('when the protocol-only fields are unset', () => {
    it('should fill the input with the protocol defaults', () => {
      const result = fromTextShape({ text: 'Hello' });

      expect(result).toEqual(
        expect.objectContaining({
          width: '1',
          height: '1',
          textWrapping: false,
          shadowBlur: '0',
          shadowOffsetX: '0',
          shadowOffsetY: '0',
          shadowColor: '#FFFFFF',
          textColorAlpha: '1',
        }),
      );
    });
  });

  describe('when the text color has a non-opaque alpha', () => {
    it('should carry the alpha through textColorAlpha since the hex value is RGB-only', () => {
      const result = fromTextShape({ text: 'Hello', textColor: { r: 1, g: 0, b: 0, a: 0.5 } });

      expect(result.textColor).toBe('#FF0000');
      expect(result.textColorAlpha).toBe('0.5');
    });
  });
});

describe('toTextShape', () => {
  it('should convert TextShapeInput to PBTextShape', () => {
    const textShapeInput: TextShapeInput = {
      text: 'Hello, World!',
      font: Font.F_SANS_SERIF.toString(),
      fontSize: '16',
      fontAutoSize: true,
      textAlign: TextAlignMode.TAM_MIDDLE_CENTER.toString(),
      width: '2',
      height: '3',
      paddingTop: '10',
      paddingRight: '20',
      paddingBottom: '15',
      paddingLeft: '5',
      outlineWidth: '5',
      lineSpacing: '2',
      lineCount: '3',
      textWrapping: true,
      shadowBlur: '4',
      shadowOffsetX: '5',
      shadowOffsetY: '-6',
      shadowColor: '#00FF00',
      outlineColor: '#FF0000',
      textColor: '#FF0000',
      textColorAlpha: '1',
    };

    const result: PBTextShape = toTextShape(textShapeInput);

    expect(result).toEqual({
      text: 'Hello, World!',
      font: Font.F_SANS_SERIF,
      fontSize: 16,
      fontAutoSize: true,
      textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
      width: 2,
      height: 3,
      paddingTop: 10,
      paddingRight: 20,
      paddingBottom: 15,
      paddingLeft: 5,
      outlineWidth: 1,
      lineSpacing: 200,
      lineCount: 3,
      textWrapping: true,
      shadowBlur: 4,
      shadowOffsetX: 5,
      shadowOffsetY: -6,
      shadowColor: { r: 0, g: 1, b: 0 },
      outlineColor: { r: 1, b: 0, g: 0 },
      textColor: { r: 1, b: 0, g: 0, a: 1 },
    });
  });

  describe('when the carried textColorAlpha is not opaque', () => {
    it('should reapply the carried alpha to the RGB hex color instead of forcing 1', () => {
      const input = fromTextShape({ text: 'Hello', textColor: { r: 1, g: 0, b: 0, a: 0.25 } });

      const result = toTextShape(input);

      expect(result.textColor).toEqual({ r: 1, g: 0, b: 0, a: 0.25 });
    });
  });

  describe('when the carried textColorAlpha is empty or invalid', () => {
    it('should fall back to the alpha parsed from the hex color', () => {
      const result = toTextShape({
        ...fromTextShape({ text: 'Hello' }),
        textColor: '#FF0000',
        textColorAlpha: '',
      });

      expect(result.textColor).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    });
  });

  describe('when the hex color itself carries an alpha channel', () => {
    it('should use the alpha from the 8-digit hex over the carried one', () => {
      const result = toTextShape({
        ...fromTextShape({ text: 'Hello' }),
        textColor: '#FF000080',
        textColorAlpha: '1',
      });

      expect(result.textColor?.r).toBe(1);
      expect(result.textColor?.g).toBe(0);
      expect(result.textColor?.b).toBe(0);
      expect(result.textColor?.a).toBeCloseTo(0.5, 1);
    });
  });
});

describe('when round-tripping a fully-populated code-authored PBTextShape', () => {
  it('should survive from -> to conversion unchanged, including color alphas', () => {
    const pbTextShape: PBTextShape = {
      text: 'Code authored',
      font: Font.F_MONOSPACE,
      fontSize: 24,
      fontAutoSize: false,
      textAlign: TextAlignMode.TAM_BOTTOM_RIGHT,
      width: 2.5,
      height: 4,
      paddingTop: 1,
      paddingRight: 2,
      paddingBottom: 3,
      paddingLeft: 4,
      lineSpacing: 250,
      lineCount: 7,
      textWrapping: true,
      shadowBlur: 1.5,
      shadowOffsetX: 0.5,
      shadowOffsetY: -0.5,
      outlineWidth: 2,
      shadowColor: { r: 0, g: 0, b: 1 },
      outlineColor: { r: 1, g: 0, b: 0 },
      textColor: { r: 1, g: 1, b: 0, a: 0.5 },
    };

    const result = toTextShape(fromTextShape(pbTextShape));

    expect(result).toEqual(pbTextShape);
  });
});

describe('isValidInput', () => {
  it('should return true', () => {
    const result = isValidInput();
    expect(result).toBe(true);
  });
});
