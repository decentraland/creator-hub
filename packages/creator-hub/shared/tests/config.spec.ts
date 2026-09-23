import { describe, expect, it } from 'vitest';

import { promoteAiAssistantSetting } from '../types/config';
import type { AppSettings } from '../types/settings';

type StoredSettings = Partial<AppSettings>;

describe('promoteAiAssistantSetting', () => {
  describe('when the stored settings predate the promotion', () => {
    it('should turn the assistant on and record that it has run', () => {
      const settings: StoredSettings = { aiAssistant: false };

      promoteAiAssistantSetting(settings);

      expect(settings).toEqual({ aiAssistant: true, aiAssistantPromoted: true });
    });

    it('should record that it has run even when the assistant was already on', () => {
      const settings: StoredSettings = { aiAssistant: true };

      promoteAiAssistantSetting(settings);

      expect(settings).toEqual({ aiAssistant: true, aiAssistantPromoted: true });
    });

    it('should turn the assistant on when the key is absent entirely', () => {
      const settings: StoredSettings = { experimental: false };

      promoteAiAssistantSetting(settings);

      expect(settings.aiAssistant).toBe(true);
      expect(settings.aiAssistantPromoted).toBe(true);
    });

    it('should leave every other setting untouched', () => {
      const settings: StoredSettings = {
        aiAssistant: false,
        experimental: true,
        exposeMcpServer: true,
        useApiKeyFromEnv: true,
        optimizedAssetsByPath: { '/tmp/scene': true },
      };

      promoteAiAssistantSetting(settings);

      expect(settings).toEqual({
        aiAssistant: true,
        aiAssistantPromoted: true,
        experimental: true,
        exposeMcpServer: true,
        useApiKeyFromEnv: true,
        optimizedAssetsByPath: { '/tmp/scene': true },
      });
    });
  });

  describe('when the promotion has already run', () => {
    it('should respect an assistant the creator turned back off', () => {
      const settings: StoredSettings = { aiAssistant: false, aiAssistantPromoted: true };

      promoteAiAssistantSetting(settings);

      expect(settings.aiAssistant).toBe(false);
    });

    it('should leave an enabled assistant alone', () => {
      const settings: StoredSettings = { aiAssistant: true, aiAssistantPromoted: true };

      promoteAiAssistantSetting(settings);

      expect(settings).toEqual({ aiAssistant: true, aiAssistantPromoted: true });
    });
  });

  describe('when there are no settings at all', () => {
    it('should not throw', () => {
      expect(() => promoteAiAssistantSetting(undefined)).not.toThrow();
    });
  });
});
