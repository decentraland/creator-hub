import { type ReactNode } from 'react';
import { flatten } from 'flat';
import { Typography } from 'decentraland-ui2';

import { en } from '/@/modules/store/translation/locales';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { getCurrentLocale, t } from '/@/modules/store/translation/utils';

import { Actions, Description, PageFallback } from './component.styled';

const english = flatten<typeof en, Record<string, string>>(en);

/**
 * The app-level boundary sits outside `TranslationProvider`, so it can catch an error
 * thrown before any locale was loaded; `t()` would throw on the missing locale.
 */
export function fallbackText(id: TranslationPath): string {
  return getCurrentLocale() ? t(id) : english[id];
}

type Props = {
  description: string;
  testId: string;
  /** The recovery buttons, in display order. */
  children: ReactNode;
};

export function ErrorFallback({ description, testId, children }: Props) {
  return (
    <PageFallback
      role="alert"
      data-testid={testId}
    >
      <Typography variant="h5">{fallbackText('error_boundary.title')}</Typography>
      <Description variant="body1">{description}</Description>
      <Actions>{children}</Actions>
    </PageFallback>
  );
}
