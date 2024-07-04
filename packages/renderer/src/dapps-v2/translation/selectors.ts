import {createSelector} from '@reduxjs/toolkit';
import type {RootState} from '../../modules/store';
import type {Locale, TranslationState} from './types';
import {getPreferredLocale} from './utils';

export function isLoading(translation: TranslationState) {
  return translation.status === 'loading';
}

export function mapLocale(translation: TranslationState, locales: Locale[]) {
  return translation.locale || getPreferredLocale(locales) || locales[0];
}

export function getLocale(translation: TranslationState, locales: Locale[]): Locale | undefined {
  return !isLoading(translation) ? mapLocale(translation, locales) : undefined;
}

export const selectTranslations = createSelector(
  [(state: RootState) => state.translation, (_, locales: Locale[]) => locales],
  (translation, locales) => {
    const locale = getLocale(translation, locales);
    if (locale) {
      const translationsInState = translation.value[locale] || undefined;
      return {locale, translations: translationsInState};
    }

    return {locale, translations: undefined};
  },
);
