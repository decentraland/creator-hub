import { useEffect, useState } from 'react';

import { useDispatch, useSelector } from '#store';
import type { Locale } from '/@/modules/store/reducers/translation/types';
import { I18nProvider } from '/@/modules/store/reducers/translation/utils';
import { selectTranslations } from './selectors';
import type { Props } from './types';

export function TranslationProvider({ children, locales, fetchTranslations }: Props) {
  const dispatch = useDispatch();
  const { locale, translations } = useSelector(state => selectTranslations(state, locales));
  const [_locale, setLocale] = useState<Locale | undefined>();

  useEffect(() => {
    if (locale && _locale !== locale) {
      dispatch(fetchTranslations(locale));
      setLocale(locale);
    }
  }, [fetchTranslations]);

  return translations && locale ? (
    <I18nProvider
      locale={locale}
      messages={translations}
    >
      {children}
    </I18nProvider>
  ) : (
    'LOADING'
  );
}
