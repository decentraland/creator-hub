import {
  parseHexColor,
  parseVariableDefault,
  validateVariableDefault,
  validateAssetPath,
} from '@dcl/asset-packs';

describe('parseHexColor', () => {
  it('parses a 6-digit hex into normalized rgb with opaque alpha', () => {
    expect(parseHexColor('#ff8000')).toEqual({ r: 1, g: 128 / 255, b: 0, a: 1 });
  });

  it('parses an 8-digit hex including the alpha channel', () => {
    expect(parseHexColor('#00ff0080')).toEqual({ r: 0, g: 1, b: 0, a: 128 / 255 });
  });

  it('tolerates a missing leading #', () => {
    expect(parseHexColor('ffffff')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('falls back to opaque black on an invalid length', () => {
    expect(parseHexColor('#abc')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(parseHexColor('')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('keeps channels NaN-safe for non-hex byte pairs', () => {
    const c = parseHexColor('#zzzzzz');
    expect(Number.isNaN(c.r)).toBe(false);
    expect(Number.isNaN(c.g)).toBe(false);
    expect(Number.isNaN(c.b)).toBe(false);
    expect(c).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
});

describe('validateVariableDefault', () => {
  describe('when the type is number', () => {
    it('accepts integers and decimals', () => {
      expect(validateVariableDefault('number', '42')).toBeNull();
      expect(validateVariableDefault('number', '-3.14')).toBeNull();
    });

    it('rejects non-numeric input', () => {
      expect(validateVariableDefault('number', 'abc')).toBe('Must be a number');
    });
  });

  describe('when the type is color', () => {
    it('accepts 6- and 8-digit hex with or without #', () => {
      expect(validateVariableDefault('color', '#ffffff')).toBeNull();
      expect(validateVariableDefault('color', 'ff8000aa')).toBeNull();
    });

    it('rejects non-hex input', () => {
      expect(validateVariableDefault('color', 'zzz')).toBe('Must be a hex color (e.g. #RRGGBB)');
    });
  });

  describe('when the type is boolean', () => {
    it('accepts true and false', () => {
      expect(validateVariableDefault('boolean', 'true')).toBeNull();
      expect(validateVariableDefault('boolean', 'false')).toBeNull();
    });

    it('rejects anything else', () => {
      expect(validateVariableDefault('boolean', 'maybe')).toBe("Must be 'true' or 'false'");
    });
  });

  describe('when the type is string or string-array', () => {
    it('treats them as free text including ".."', () => {
      expect(validateVariableDefault('string', '../anything')).toBeNull();
      expect(validateVariableDefault('string', 'plain text')).toBeNull();
      expect(validateVariableDefault('string-array', 'a\nb')).toBeNull();
    });
  });
});

describe('parseVariableDefault', () => {
  it('coerces a finite number, else 0', () => {
    expect(parseVariableDefault('number', '7.5')).toBe(7.5);
    expect(parseVariableDefault('number', 'nope')).toBe(0);
  });

  it('coerces a boolean from the literal "true"', () => {
    expect(parseVariableDefault('boolean', 'true')).toBe(true);
    expect(parseVariableDefault('boolean', 'false')).toBe(false);
  });

  it('coerces a color via the strict hex codec', () => {
    expect(parseVariableDefault('color', '#ffffff')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('splits a string-array on newlines, dropping empties', () => {
    expect(parseVariableDefault('string-array', 'a\n\nb\n')).toEqual(['a', 'b']);
  });

  it('passes a string through verbatim', () => {
    expect(parseVariableDefault('string', 'hello')).toBe('hello');
  });
});

describe('validateAssetPath', () => {
  it('rejects traversal, backslashes, encoded dots, and absolute paths', () => {
    expect(validateAssetPath('../secret')).toBe('Invalid asset path');
    expect(validateAssetPath('a\\b')).toBe('Invalid asset path');
    expect(validateAssetPath('a%2e%2e/b')).toBe('Invalid asset path');
    expect(validateAssetPath('/abs')).toBe('Invalid asset path');
  });

  it('accepts a relative file path and the empty (unset) string', () => {
    expect(validateAssetPath('foo/bar.png')).toBeNull();
    expect(validateAssetPath('')).toBeNull();
  });
});
