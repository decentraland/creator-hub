import { describe, expect, it } from 'vitest';

import { toComponentName, uniqueRootName } from './root-naming';

describe('when deriving a UI-root component name', () => {
  it('should PascalCase words and strip non-identifier characters', () => {
    expect(toComponentName('main menu')).toBe('MainMenu');
    expect(toComponentName('my-cool_screen 2')).toBe('MyCoolScreen2');
    expect(toComponentName('HUD')).toBe('HUD');
  });

  it('should guarantee a valid leading character', () => {
    // A TS identifier can't start with a digit.
    expect(toComponentName('123 panel')).toBe('Panel');
    expect(toComponentName('99')).toBe('MainUI');
  });

  it('should fall back to MainUI for empty/garbage input', () => {
    expect(toComponentName('')).toBe('MainUI');
    expect(toComponentName('   ')).toBe('MainUI');
    expect(toComponentName('!@#$')).toBe('MainUI');
  });
});

describe('when ensuring a unique root name', () => {
  it('should return the base name when unused', () => {
    expect(uniqueRootName('MainUI', [])).toBe('MainUI');
    expect(uniqueRootName('MainUI', ['Hud', 'Menu'])).toBe('MainUI');
  });

  it('should append the smallest free numeric suffix on collision', () => {
    expect(uniqueRootName('MainUI', ['MainUI'])).toBe('MainUI1');
    expect(uniqueRootName('MainUI', ['MainUI', 'MainUI1', 'MainUI2'])).toBe('MainUI3');
    // Gaps are filled by the smallest missing suffix.
    expect(uniqueRootName('MainUI', ['MainUI', 'MainUI2'])).toBe('MainUI1');
  });
});
