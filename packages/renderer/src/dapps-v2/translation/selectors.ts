import type { RootState } from '../../modules/store';
import type { Locale, TranslationKeys } from './types';
import { getPreferredLocale } from './utils';

export function isLoading({ translation }: RootState) {
  return translation.status === 'loading';
}

export function mapLocale({ translation }: RootState, locales: Locale[]) {
  return translation.locale || getPreferredLocale(locales) || locales[0];
}

export function selectLocale(
  state: RootState,
  locales: Locale[],
): Locale | undefined {
  return !isLoading(state) ? mapLocale(state, locales) : undefined;
}

export function selectTranslations(
  state: RootState,
  locales: Locale[],
): {
  locale?: Locale;
  translations?: TranslationKeys;
} {
  const { translation } = state;
  const locale = selectLocale(state, locales);
  if (locale) {
    const translationsInState = translation.value[locale] || undefined;
    return { locale, translations: translationsInState };
  }

  return { locale };
}
