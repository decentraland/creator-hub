import { Button, styled } from 'decentraland-ui2';

import { focusRing, typeToken } from './tokens';

const Hero = styled('section')({
  '--g': 'clamp(16px, 5.104vw, 98px)',
  '--m': 'clamp(0px, 3.125vw, 60px)',
  '--text-right': 'calc(var(--g) + var(--m) + min(800px, 100vw - 2 * var(--g) - var(--m)))',
  '--hero-gap': 'clamp(32px, 6.667vw, 128px)',
  '--hero-w':
    'max(0px, min(1425px, 74.22vw, calc((100vh - 115px) * 1425 / 965), calc((100vw - var(--text-right) - var(--hero-gap)) / 0.5846)))',
  '--hero-bottom': 'max(0px, calc(187px - var(--hero-w) * 0.1312))',
  '--hero-fade': 'min(var(--hero-bottom), calc(var(--hero-w) * 0.1312))',
  position: 'relative',
  width: '100%',
  minHeight: 'calc(100vh - 130px)',
  padding: '0 var(--g) 117px',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  overflowX: 'clip',
});

const HeroImage = styled('img')({
  position: 'absolute',
  right: 0,
  bottom: 'var(--hero-bottom)',
  zIndex: 0,
  width: 'var(--hero-w)',
  height: 'auto',
  pointerEvents: 'none',
  maskImage: 'linear-gradient(to top, transparent 0, black var(--hero-fade))',
  WebkitMaskImage: 'linear-gradient(to top, transparent 0, black var(--hero-fade))',
  '@media (max-width: 1429.46px), (max-height: 597.5px)': { display: 'none' },
});

const Information = styled('div')({
  position: 'relative',
  zIndex: 1,
  marginBlock: 'auto',
  marginLeft: 'var(--m)',
  width: 'min(800px, 100%)',
  transform: 'translateY(-1.5px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 60,
});

const Intro = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 30,
});

const TitleBlock = styled('div')({
  display: 'flex',
  flexDirection: 'column',
});

const Title = styled('h1')({
  fontSize: 'var(--fs-display)',
  fontWeight: 'var(--fw-bold)',
  lineHeight: 'normal',
  letterSpacing: 0,
  margin: 0,
  color: 'var(--palette-neutral-softWhite)',
});

const TitleDot = styled('span')({
  fontWeight: 400,
});

const Tagline = styled('p')({
  ...typeToken('h3-semi'),
  margin: 0,
  width: 'fit-content',
  backgroundImage: 'linear-gradient(180deg, var(--primary), var(--lavender))',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  color: 'transparent',
});

const Description = styled('p')({
  ...typeToken('h5-regular'),
  margin: 0,
  color: 'var(--gray)',
});

const Highlight = styled('span')({
  color: 'var(--palette-neutral-softWhite)',
});

const KnowMore = styled('a')({
  fontWeight: 'var(--fw-bold)',
  color: 'var(--palette-neutral-softWhite)',
  textDecoration: 'underline',
  whiteSpace: 'nowrap',
  borderRadius: 'var(--shape-borderRadiusMedium)',
  cursor: 'pointer',
  ...focusRing,
});

const Features = styled('ul')({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 30,
});

const Feature = styled('li')({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

const FeatureTitle = styled('span')({
  ...typeToken('h6-semi'),
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: 'var(--palette-neutral-softWhite)',
  '& svg': { flexShrink: 0 },
});

const FeatureBody = styled('span')({
  ...typeToken('h6-regular'),
  color: 'var(--gray)',
});

const CtaArea = styled('div')({
  position: 'relative',
  zIndex: 1,
  marginTop: 30,
  marginLeft: 'var(--m)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 10,
});

const CtaRow = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
  gap: 20,
  maxWidth: '100%',
  '&& .MuiButton-root + .MuiButton-root': { marginLeft: 0 },
});

const HeroCta = styled(Button)({
  '&&&&&&&': {
    ...typeToken('h5-semi'),
    lineHeight: '22px',
    minHeight: 56,
    maxWidth: '100%',
    padding: '12px 40px',
    gap: 10,
    borderRadius: 'var(--shape-borderRadiusXLarge)',
    textTransform: 'uppercase',
    whiteSpace: 'normal',
    textAlign: 'center',
    color: 'var(--palette-neutral-softWhite)',
    boxShadow: 'none',
    ...focusRing,
  },
  '&&&&&&&.MuiButton-containedPrimary': { backgroundColor: 'var(--primary)' },
  '&&&&&&&.MuiButton-containedSecondary': {
    backgroundColor: 'var(--palette-whiteTransparent-subtle)',
  },
  '&&&&&&&.MuiButton-containedPrimary:hover': { backgroundColor: 'var(--primary-hover)' },
  '&&&&&&&.MuiButton-containedSecondary:hover': {
    backgroundColor: 'var(--palette-whiteTransparent-soft)',
  },
});

const StatusLine = styled('p')({
  ...typeToken('h6-regular'),
  margin: 0,
  color: 'var(--gray)',
  textAlign: 'center',
});

const CtaEmoji = styled('img')({
  display: 'block',
  flexShrink: 0,
});

export {
  CtaArea,
  CtaEmoji,
  CtaRow,
  Description,
  Feature,
  FeatureBody,
  Features,
  FeatureTitle,
  Hero,
  HeroCta,
  HeroImage,
  Highlight,
  Information,
  Intro,
  KnowMore,
  StatusLine,
  Tagline,
  Title,
  TitleBlock,
  TitleDot,
};
