import {
  createTranslationSlice,
  createTranslationFetcher,
} from '../../../../dapps-v2/translation/slice';
import type {TranslationFetcherOpts} from '../../../../dapps-v2/translation/types';
import * as languages from './languages';

export const fetchTranslations = createTranslationFetcher({
  translations: languages as any as TranslationFetcherOpts['translations'],
});

export const {actions, reducer, selectors} = createTranslationSlice({
  fetchTranslations,
});
