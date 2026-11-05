import { alpha, styled } from 'decentraland-ui2';

import type { RoleTagVariant } from './types';

const Tag = styled('span')<{ variant: RoleTagVariant }>(({ theme, variant }) => {
  const color = variant === 'tenant' ? theme.palette.warning : theme.palette.info;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    padding: theme.spacing(0.5, 1.25),
    borderRadius: 100,
    backgroundColor: alpha(variant === 'tenant' ? color.main : color.dark, 0.2),
    color: color.light,
    fontFamily: theme.typography.body1.fontFamily,
    fontSize: theme.typography.pxToRem(16),
    fontWeight: 400,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  };
});

export { Tag };
