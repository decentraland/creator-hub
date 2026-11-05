import { styled } from 'decentraland-ui2';

import { focusRing, typeToken } from '../tokens';

const Banner = styled('div')({
  position: 'relative',
  minHeight: 200,
  boxSizing: 'border-box',
  paddingBlock: 30,
  display: 'flex',
  alignItems: 'center',
  backgroundColor: 'var(--onyx)',
  border: '1px solid var(--palette-whiteTransparent-subtle)',
  borderRadius: 'var(--shape-borderRadiusXLarge)',
  overflow: 'hidden',
  '&::before, &::after': {
    content: '""',
    position: 'absolute',
    borderRadius: '50%',
    backgroundColor: 'var(--palette-rarity-mythic)',
    pointerEvents: 'none',
  },
  '&::before': {
    width: 677,
    height: 590,
    right: -396,
    top: -370,
    opacity: 0.4,
    filter: 'blur(100px)',
  },
  '&::after': {
    width: 196,
    height: 163,
    left: -86,
    top: 207,
    opacity: 0.5,
    filter: 'blur(75px)',
  },
});

const BannerText = styled('div')({
  position: 'relative',
  zIndex: 1,
  marginLeft: 81,
  width: 'min(875px, 100% - 81px - 40px)',
  '& .MarkdownRenderer, & .MarkdownRenderer p': {
    ...typeToken('h5-regular'),
    lineHeight: '26px',
    letterSpacing: '-0.1px',
    margin: 0,
    padding: 0,
    overflow: 'visible',
    color: 'var(--palette-neutral-softWhite)',
  },
  '& .MarkdownRenderer a': {
    color: 'var(--palette-neutral-softWhite)',
    textDecoration: 'underline',
    ...focusRing,
  },
});

export { Banner, BannerText };
