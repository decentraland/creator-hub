import type { Locale } from '/shared/types/translation';
import { getPreferredLocale as getPreferredLocaleFromUtils } from '/@/modules/store/translation/utils';

/**
 * Returns the user's preferred locale based on browser/OS language, or null if not supported.
 * Re-exported from translation utils for components that need it (e.g. language picker).
 */
export function getPreferredLocale(): Locale | null {
  return getPreferredLocaleFromUtils();
}
