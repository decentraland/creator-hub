import type {ReactNode} from 'react';

import type {Locale} from '/@/modules/store/reducers/translation/types';
import type { createTranslationFetcher } from '/@/modules/store/reducers/translation/slice';

export type Props = {
  fetchTranslations: (locale: Locale) => ReturnType<ReturnType<typeof createTranslationFetcher>>;
  locales: Locale[];
  children?: ReactNode;
};
