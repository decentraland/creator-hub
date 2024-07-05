import { createTranslationFetcher, createTranslationSlice } from './slice';
import type { TranslationFetcherOpts } from './types';
import * as languages from './languages';

export const fetchTranslations = createTranslationFetcher({
  translations: languages as any as TranslationFetcherOpts['translations'],
});

export const { actions, reducer, selectors } = createTranslationSlice({
  fetchTranslations,
});
