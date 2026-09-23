import { describe, expect, it } from 'vitest';
import { dropGuiEditorSetting } from '../types/config';
import type { AppSettings } from '../types/settings';

type LegacySettings = Partial<AppSettings> & { guiEditor?: boolean };

describe('dropGuiEditorSetting', () => {
  describe('when the settings carry the legacy guiEditor key', () => {
    it('should remove the key when it is false', () => {
      const settings: LegacySettings = { guiEditor: false };
      dropGuiEditorSetting(settings);
      expect('guiEditor' in settings).toBe(false);
    });

    it('should remove the key when it is true', () => {
      const settings: LegacySettings = { guiEditor: true };
      dropGuiEditorSetting(settings);
      expect('guiEditor' in settings).toBe(false);
    });

    it('should leave every other setting untouched', () => {
      const settings: LegacySettings = {
        guiEditor: true,
        experimental: true,
        aiAssistant: false,
        optimizedAssetsByPath: { '/tmp/scene': true },
      };
      dropGuiEditorSetting(settings);
      expect(settings).toEqual({
        experimental: true,
        aiAssistant: false,
        optimizedAssetsByPath: { '/tmp/scene': true },
      });
    });
  });

  describe('when the settings never had the key', () => {
    it('should leave them unchanged', () => {
      const settings: LegacySettings = { experimental: false };
      dropGuiEditorSetting(settings);
      expect('guiEditor' in settings).toBe(false);
      expect(settings).toEqual({ experimental: false });
    });
  });

  describe('when the settings are undefined', () => {
    it('should not throw', () => {
      expect(() => dropGuiEditorSetting(undefined)).not.toThrow();
    });
  });
});
