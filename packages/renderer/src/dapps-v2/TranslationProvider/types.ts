import type { ReactNode } from 'react';

import type { Locale } from '../translation/types';
import type { createTranslationFetcher } from '../translation/slice';

export type Props = {
  fetchTranslations: (
    locale: Locale,
  ) => ReturnType<ReturnType<typeof createTranslationFetcher>>;
  locales: Locale[];
  children?: ReactNode;
};
