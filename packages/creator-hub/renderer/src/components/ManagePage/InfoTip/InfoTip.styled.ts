import { alpha, dclColors, styled } from 'decentraland-ui2';

import { Popper } from '../../Popper';

const { neutral, whiteTransparent } = dclColors;

const Bubble = styled('div')(({ theme }) => ({
  position: 'relative',
  isolation: 'isolate',
  maxWidth: 300,
  marginBottom: theme.spacing(1.75),
  padding: theme.spacing(2, 2.5),
  borderRadius: 12,
  backgroundColor: 'var(--palette-neutral-onyx)',
  boxShadow: `0 2px 3px ${alpha(neutral.black, 0.25)}`,
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(14),
  fontWeight: 400,
  lineHeight: 1.3,
  textAlign: 'left',
  whiteSpace: 'normal',
}));

const GLYPH_PX = { small: 13.2, medium: 16.8 };

const InfoButton = styled('button', {
  shouldForwardProp: prop => prop !== 'look' && prop !== 'size',
})<{ look: 'info' | 'warning'; size: keyof typeof GLYPH_PX }>(({ theme, look, size }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  padding: 0,
  border: 'none',
  borderRadius: 100,
  backgroundColor: 'transparent',
  color: look === 'warning' ? theme.palette.warning.main : neutral.softWhite,
  cursor: 'pointer',
  '& svg': { fontSize: theme.typography.pxToRem(GLYPH_PX[size]) },
  '&:hover, &[aria-expanded="true"]': {
    backgroundColor: whiteTransparent.subtle,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const Peak = styled('span')({
  position: 'absolute',
  zIndex: -1,
  bottom: -6,
  left: 'calc(50% - 13px)',
  width: 26,
  height: 26,
  borderRadius: 5,
  backgroundColor: 'var(--palette-neutral-onyx)',
  transform: 'rotate(45deg)',
});

const TipPopper = styled(Popper)(({ theme }) => ({
  '&&': {
    zIndex: theme.zIndex.tooltip,
    backgroundColor: 'transparent',
  },
}));

const Wrapper = styled('div')({
  display: 'inline-flex',
});

export { Bubble, InfoButton, Peak, TipPopper, Wrapper };
