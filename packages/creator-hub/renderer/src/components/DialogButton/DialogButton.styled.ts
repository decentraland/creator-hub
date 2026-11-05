import { dclColors, styled } from 'decentraland-ui2';

const { neutral, whiteTransparent } = dclColors;

const DialogButton = styled('button', {
  shouldForwardProp: prop => prop !== 'tone',
})<{ tone: 'primary' | 'secondary' }>(({ theme, tone }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 46,
  padding: theme.spacing(1.5, 3),
  border: 0,
  borderRadius: 12,
  backgroundColor: tone === 'primary' ? theme.palette.primary.main : whiteTransparent.subtle,
  cursor: 'pointer',
  color: neutral.softWhite,
  fontFamily: 'inherit',
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 600,
  lineHeight: theme.typography.pxToRem(22),
  letterSpacing: 0,
  textTransform: 'uppercase',
  '&:hover:not(:disabled)': {
    backgroundColor: tone === 'primary' ? 'var(--primary-hover)' : whiteTransparent.soft,
  },
  '&:disabled': { opacity: 0.2, cursor: 'not-allowed' },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

export { DialogButton };
