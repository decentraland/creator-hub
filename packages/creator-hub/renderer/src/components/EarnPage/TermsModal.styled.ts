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
  overflow: 'hidden',
  boxSizing: 'border-box',
  borderRadius: 'var(--shape-borderRadiusLarge)',
  padding: '10px 10px 10px 0',
  backgroundColor: 'var(--palette-blackTransparent-blurry)',
  display: 'flex',
  flexDirection: 'column',
  '&[data-variant="read"]': { backgroundColor: 'var(--palette-blackTransparent-soft)' },
  '&:has(> :focus-visible)': {
    outline: '2px solid var(--palette-info-light)',
    outlineOffset: 2,
  },
});

const Scroller = styled('div')({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  boxSizing: 'border-box',
  padding: '20px 28px 20px 40px',
  display: 'flex',
  flexDirection: 'column',
  gap: 30,
  outline: 'none',
  '&::-webkit-scrollbar': { width: 12 },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'var(--scrollbar-thumb)',
    border: '1px solid var(--scrollbar-thumb-border)',
    borderRadius: 'var(--r-pill)',
  },
});

const HEADING = ':is(h1, h2, h3, h4, h5, h6)';
const BODY_BLOCK = ':is(p, ul, ol, blockquote, pre, hr, table)';

const TermsText = styled('div')({
  overflowWrap: 'anywhere',
  '& .MarkdownRenderer': {
    ...typeToken('h7-regular'),
    lineHeight: 1.7,
    overflow: 'visible',
    padding: 0,
    color: 'var(--palette-neutral-softWhite)',
  },
  [`& .MarkdownRenderer ${HEADING}`]: {
    ...typeToken('h5-semi'),
    lineHeight: 1.4,
    margin: 0,
  },
  '& .MarkdownRenderer h1': { ...typeToken('h4-semi'), lineHeight: 1.4 },
  [`& .MarkdownRenderer ${BODY_BLOCK}`]: { margin: 0 },
  '& .MarkdownRenderer :is(ul, ol)': { paddingLeft: 24 },
  '& .MarkdownRenderer li': { marginTop: 0 },
  '& .MarkdownRenderer li + li': { marginTop: 8 },
  [`& .MarkdownRenderer ${BODY_BLOCK} + ${BODY_BLOCK}`]: { marginTop: 20 },
  [`& .MarkdownRenderer ${BODY_BLOCK} + ${HEADING}`]: { marginTop: 40 },
  [`& .MarkdownRenderer ${HEADING} + *`]: { marginTop: 10 },
  '& .MarkdownRenderer a': {
    color: 'var(--primary)',
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' },
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
  '& .MuiFormControlLabel-root': { margin: 0, gap: 10, paddingBlock: 1 },
  '& .MuiFormControlLabel-label': { ...typeToken('h7-regular'), color: 'var(--dcl-silver)' },
  '& .MuiCheckbox-root': { padding: 0 },
});

const TickBox = styled('span')({
  position: 'relative',
  boxSizing: 'border-box',
  width: 20,
  height: 20,
  borderRadius: 5,
  boxShadow: 'inset 0 0 0 1px var(--palette-whiteTransparent-blurry)',
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: -6,
    zIndex: -1,
    borderRadius: 100,
  },
  '.MuiFormControlLabel-root:hover &::before': {
    backgroundColor: 'var(--palette-whiteTransparent-subtle)',
  },
  '&[data-checked]': { backgroundColor: 'var(--primary)', boxShadow: 'none' },
  '.MuiFormControlLabel-root:hover &[data-checked]::before': {
    backgroundColor: 'color-mix(in srgb, var(--primary) 20%, transparent)',
  },
  '.Mui-focusVisible > &': {
    outline: '2px solid var(--palette-info-light)',
    outlineOffset: 2,
  },
  '& > svg': { position: 'absolute', left: 4, top: 5, color: 'var(--black)' },
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
  Scroller,
  Scrollview,
  Subtitle,
  TermsText,
  TickBox,
  Title,
  TitleBar,
  TitleBarClose,
  TitleText,
};
