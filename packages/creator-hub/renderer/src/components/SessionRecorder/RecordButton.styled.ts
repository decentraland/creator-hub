import { dclColors, keyframes, styled } from 'decentraland-ui2';

const { neutral } = dclColors;

const pulse = keyframes({
  '0%': { opacity: 1 },
  '50%': { opacity: 0.25 },
  '100%': { opacity: 1 },
});

const Dot = styled('span', {
  shouldForwardProp: prop => prop !== 'live',
})<{ live: boolean }>(({ theme, live }) => ({
  width: 10,
  height: 10,
  flexShrink: 0,
  borderRadius: '50%',
  backgroundColor: live ? neutral.softWhite : theme.palette.error.main,
  animation: live ? `${pulse} 1.2s ease-in-out infinite` : 'none',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
}));

const Label = styled('span')({
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
});

const RecordControl = styled('button', {
  shouldForwardProp: prop => prop !== 'live' && prop !== 'full',
})<{ live: boolean; full: boolean }>(({ theme, live, full }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  width: full ? '100%' : 'auto',
  height: full ? 36 : 32,
  padding: theme.spacing(0, 1.5),
  borderRadius: 8,
  border: `1px solid ${theme.palette.error.main}`,
  backgroundColor: live ? theme.palette.error.main : 'transparent',
  color: neutral.softWhite,
  fontFamily: theme.typography.fontFamily,
  fontSize: theme.typography.pxToRem(14),
  fontWeight: 600,
  cursor: 'pointer',
  '&:hover:not(:disabled)': {
    backgroundColor: live ? theme.palette.error.dark : theme.palette.action.hover,
  },
  '&:disabled': { cursor: 'default', opacity: 0.7 },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

export { Dot, Label, RecordControl };
