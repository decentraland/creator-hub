import { TYPE, parse } from '@formatjs/icu-messageformat-parser';
import { describe, expect, it } from 'vitest';

import en from './locales/en.json';
import es from './locales/es.json';
import zh from './locales/zh.json';

/**
 * `TranslationPath` is derived from `en.json` alone and `TranslationKeys` is a bare
 * `Record<string, string>`, so nothing type-checks the other locales against English.
 * With no `onError` on the `IntlProvider` either, a key missing here does not fall back
 * to English — react-intl renders the id, and the user reads
 * "analytics.detail.window.title" as UI text. This is the only thing that catches it.
 */
const flatten = (
  value: unknown,
  prefix = '',
  out: Record<string, string> = {},
): Record<string, string> => {
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out[prefix] = String(value);
  }
  return out;
};

/**
 * The argument names a message reads, via react-intl's own parser rather than a brace
 * regex: in `{count, plural, one {scene} other {scenes}}` the only argument is `count`,
 * and the sub-messages are literals a translator is supposed to translate.
 */
const argumentNames = (message: string): string[] => {
  const names = new Set<string>();

  const walk = (elements: any[]) => {
    for (const element of elements) {
      if (element.type === TYPE.literal || element.type === TYPE.pound) continue;
      if (element.value) names.add(element.value);
      if (element.children) walk(element.children);
      for (const option of Object.values<any>(element.options ?? {})) walk(option.value);
    }
  };

  walk(parse(message));
  return [...names].sort();
};

const EN = flatten(en);
const EN_KEYS = Object.keys(EN).sort();

describe('translation locales', () => {
  describe.each([
    ['es', es],
    ['zh', zh],
  ])('%s', (_locale, translation) => {
    const messages = flatten(translation);
    const keys = Object.keys(messages).sort();

    it('should translate every key English defines', () => {
      expect(EN_KEYS.filter(key => !keys.includes(key))).toEqual([]);
    });

    it('should not carry keys English no longer defines', () => {
      expect(keys.filter(key => !EN_KEYS.includes(key))).toEqual([]);
    });

    /*
     * A renamed placeholder is silently dropped at format time — the value never
     * reaches the string. Machine translation renames them readily: "Data as of
     * {date}" comes back from DeepL as "Datos a fecha de {fecha}".
     */
    it('should keep the placeholder names English uses', () => {
      const renamed = EN_KEYS.filter(
        key =>
          key in messages && argumentNames(EN[key]).join() !== argumentNames(messages[key]).join(),
      );

      expect(renamed).toEqual([]);
    });
  });
});
