import { dclColors, styled } from 'decentraland-ui2';

import { ExternalLink } from '../../ExternalLink';

const { neutral } = dclColors;

const ExplorerLink = styled(ExternalLink)(({ theme }) => ({
  alignSelf: 'flex-start',
  color: theme.palette.primary.main,
  fontSize: theme.typography.pxToRem(16),
  textDecoration: 'underline',
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const Root = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const StateRow = styled('div')<{ tone: 'progress' | 'success' | 'warning' | 'error' }>(
  ({ theme, tone }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    color: neutral.softWhite,
    fontSize: theme.typography.pxToRem(16),
    lineHeight: 1.3,
    '& > .Loader': {
      width: 'auto',
      height: 'auto',
      flexShrink: 0,
    },
    '& > svg': {
      flexShrink: 0,
      fontSize: theme.typography.pxToRem(24),
      color: {
        progress: neutral.softWhite,
        success: theme.palette.success.main,
        warning: theme.palette.warning.main,
        error: theme.palette.error.main,
      }[tone],
    },
  }),
);

const Step = styled('span')(({ theme }) => ({
  color: neutral.gray3,
  fontSize: theme.typography.pxToRem(14),
}));

export { ExplorerLink, Root, StateRow, Step };
