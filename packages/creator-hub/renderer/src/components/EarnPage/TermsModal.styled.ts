import { IconButton, styled } from 'decentraland-ui2';

import { focusRing, typeToken } from './tokens';

const Dialog = styled('div')({
  position: 'relative',
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  outline: 'none',
});

const TitleBar = styled('div')({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 20px',
  backgroundColor: 'var(--palette-blackTransparent-soft)',
  borderBottom: '1px solid var(--palette-whiteTransparent-subtle)',
});

const TitleText = styled('div')({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
});

const Title = styled('h2')({
  ...typeToken('h5-semi'),
  lineHeight: 1.7,
  margin: 0,
  color: 'var(--palette-neutral-softWhite)',
});

const Subtitle = styled('p')({
  ...typeToken('h7-regular'),
  lineHeight: 1.7,
  margin: 0,
  color: 'var(--dcl-silver)',
});

const TitleBarClose = styled(IconButton)({
  width: 30,
  height: 30,
  borderRadius: 'var(--r-pill)',
  backgroundColor: 'var(--palette-whiteTransparent-subtle)',
  color: 'var(--gray)',
  '&:hover': { backgroundColor: 'var(--palette-whiteTransparent-soft)' },
  ...focusRing,
});

const Glow = styled('div')({
  position: 'absolute',
  width: 824,
  height: 257.5,
  left: '50%',
  bottom: -131.5,
  transform: 'translateX(-50%) scaleY(-1)',
  borderRadius: '50%',
  backgroundColor: 'var(--palette-rarity-mythic)',
  opacity: 0.3,
  filter: 'blur(250px)',
  pointerEvents: 'none',
});

const Scrollview = styled('div')({
  position: 'relative',
  zIndex: 1,
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 25,
  padding: 50,
  '&[data-variant="read"]': { gap: 50 },
});

const Box = styled('div')({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  borderRadius: 'var(--shape-borderRadiusLarge)',
  padding: '30px 50px 30px 40px',
  backgroundColor: 'var(--palette-blackTransparent-blurry)',
  display: 'flex',
  flexDirection: 'column',
  gap: 30,
  overscrollBehavior: 'contain',
  '&[data-variant="read"]': { backgroundColor: 'var(--palette-blackTransparent-soft)' },
  '&::-webkit-scrollbar': { width: 12 },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'var(--scrollbar-thumb)',
    border: '1px solid var(--scrollbar-thumb-border)',
    borderRadius: 'var(--r-pill)',
  },
  ...focusRing,
});

const TermsText = styled('div')({
  overflowWrap: 'anywhere',
  '& .MarkdownRenderer': {
    ...typeToken('h7-regular'),
    overflow: 'visible',
    padding: 0,
    color: 'var(--palette-neutral-softWhite)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  '& .MarkdownRenderer :is(h1, h2, h3, h4, h5, h6)': {
    ...typeToken('h6-semi'),
    margin: '20px 0 0',
  },
  '& .MarkdownRenderer :is(h1, h2, h3, h4, h5, h6):first-child': { marginTop: 0 },
  '& .MarkdownRenderer :is(p, ul, ol)': { margin: 0 },
  '& .MarkdownRenderer a': {
    color: 'var(--palette-neutral-softWhite)',
    textDecoration: 'underline',
    ...focusRing,
  },
});

const BoxState = styled('div')({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 20,
  color: 'var(--gray)',
  ...typeToken('h6-regular'),
});

const Gate = styled('div')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  minHeight: 42,
  color: 'var(--dcl-silver)',
  '& > svg': { flexShrink: 0 },
  '& .MuiCheckbox-root .MuiSvgIcon-root': { fontSize: 18 },
  '& .MuiFormControlLabel-root': { margin: 0, gap: 10 },
  '& .MuiFormControlLabel-label': { ...typeToken('h7-regular'), color: 'var(--dcl-silver)' },
  '& .MuiCheckbox-root': { padding: 0 },
  '& .MuiCheckbox-root.Mui-focusVisible': {
    outline: '2px solid var(--palette-info-light)',
    outlineOffset: 2,
  },
});

const Hint = styled('span')({
  ...typeToken('h8-regular'),
});

export {
  Box,
  BoxState,
  Dialog,
  Gate,
  Glow,
  Hint,
  Scrollview,
  Subtitle,
  TermsText,
  Title,
  TitleBar,
  TitleBarClose,
  TitleText,
};
