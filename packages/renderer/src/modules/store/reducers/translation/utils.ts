import type { Locale } from '../../../../dapps-v2/translation/types';
import * as languages from './languages';

export const locales = Object.keys(languages) as Locale[];
