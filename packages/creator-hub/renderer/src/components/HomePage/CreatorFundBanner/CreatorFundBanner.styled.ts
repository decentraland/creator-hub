import { Button, styled } from 'decentraland-ui2';

import { focusRing, fontFace, typeToken } from '/@/components/EarnPage/tokens';

const Banner = styled('section')({
  position: 'relative',
  isolation: 'isolate',
  display: 'flex',
  columnGap: 40,
  height: 270,
  marginBottom: 48,
  boxSizing: 'border-box',
  border: '1px solid var(--white-10)',
  borderRadius: 'var(--r-card)',
  overflow: 'hidden',
  backgroundColor: 'var(--creator-fund-banner-bg)',
});

const Glow = styled('div')({
  position: 'absolute',
  zIndex: 0,
  borderRadius: '50%',
  backgroundColor: 'var(--rar-mythic)',
  pointerEvents: 'none',
});

const BottomGlow = styled(Glow)({
  left: -87,
  top: 202,
  width: 485,
  height: 167,
  opacity: 0.5,
  filter: 'blur(75px)',
});

const TopGlow = styled(Glow)({
  left: -177,
  top: -431,
  width: 677,
  height: 590,
  opacity: 0.4,
  filter: 'blur(100px)',
});

const Information = styled('div')({
  position: 'relative',
  zIndex: 1,
  flex: 'none',
  alignSelf: 'center',
  paddingLeft: 58,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 10,
});

const Title = styled('h2')({
  ...fontFace,
  margin: 0,
  fontSize: 32,
  fontWeight: 'var(--fw-bold)',
  lineHeight: 'normal',
  letterSpacing: 0,
  whiteSpace: 'nowrap',
  color: 'var(--palette-neutral-softWhite)',
});

const Description = styled('p')({
  ...typeToken('h5-regular'),
  margin: 0,
  minHeight: 40,
  maxWidth: '100%',
  color: 'var(--pearl)',
});

const Cta = styled(Button)({
  '&&&&&&&': {
    ...typeToken('h6-semi'),
    lineHeight: '22px',
    minWidth: 0,
    padding: '12px 24px',
    borderRadius: 'var(--shape-borderRadiusLarge)',
    textTransform: 'uppercase',
    color: 'var(--palette-neutral-softWhite)',
    backgroundColor: 'var(--primary)',
    boxShadow: 'none',
    ...focusRing,
  },
  '&&&&&&&:hover': { backgroundColor: 'var(--primary-hover)' },
});

const ArtworkSlot = styled('div')({
  position: 'relative',
  flex: '0 1 769px',
  minWidth: 0,
  marginLeft: 'auto',
});

const Artwork = styled('img')({
  position: 'absolute',
  zIndex: 1,
  inset: 0,
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: '85% bottom',
  borderRadius: 'var(--r-card) 0 0 var(--r-card)',
  maskImage: 'linear-gradient(to right, transparent -0.85%, black 48.4%)',
  WebkitMaskImage: 'linear-gradient(to right, transparent -0.85%, black 48.4%)',
  pointerEvents: 'none',
});

const CloseButton = styled('button')({
  position: 'absolute',
  zIndex: 2,
  top: 18,
  right: 18,
  width: 40,
  height: 40,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: 'var(--r-pill)',
  backgroundColor: 'var(--black-60)',
  color: 'var(--gray)',
  cursor: 'pointer',
  '&:hover': { backgroundColor: 'var(--black-80)' },
  ...focusRing,
});

export {
  Artwork,
  ArtworkSlot,
  Banner,
  BottomGlow,
  CloseButton,
  Cta,
  Description,
  Information,
  Title,
  TopGlow,
};
