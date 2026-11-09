import { styled } from 'decentraland-ui2';

import { focusRing, typeToken } from '../tokens';
import { Information } from '../Landing.styled';

const HIDE_ART = '@media (max-width: 1341.19px), (max-height: 584.75px)';

const Area = styled('section')({
  '--g': 'clamp(16px, 5.104vw, 98px)',
  '--m': 'clamp(0px, 3.125vw, 60px)',
  '--text-right': 'calc(var(--g) + var(--m) + min(800px, 100vw - 2 * var(--g) - var(--m)))',
  '--art-gap': 'clamp(32px, 5.026vw, 96.5px)',
  '--art-w':
    'min(794px, calc((100vh - 284px) * 794 / 796), calc((100vw - 8px - var(--g) - var(--text-right) - var(--art-gap)) / 0.95655))',
  position: 'relative',
  height: 'calc(100vh - 305px)',
  minHeight: 'min-content',
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr) auto minmax(0, 1fr) minmax(0, 93px)',
});

const Scenery = styled('div')({
  position: 'absolute',
  top: -30,
  bottom: 0,
  left: 0,
  right: 'calc(-1 * var(--g))',
  overflow: 'hidden',
  pointerEvents: 'none',
  [HIDE_ART]: { display: 'none' },
});

const ArtBox = styled('div')({
  position: 'absolute',
  top: 'calc(50% - 2.5px)',
  right: 'var(--g)',
  width: 'var(--art-w)',
  transform: 'translateY(-50%)',
});

const Floor = styled('div')({
  position: 'absolute',
  left: '-31.99%',
  top: '76.26%',
  width: '177.71%',
  height: '43.09%',
  borderRadius: '50%',
  backgroundColor: 'var(--palette-rarity-mythic)',
  opacity: 0.2,
  filter: 'blur(calc(var(--art-w) * 100 / 794))',
});

const Art = styled('img')({
  position: 'relative',
  display: 'block',
  width: '100%',
  height: 'auto',
});

const Column = styled(Information)({
  gridRow: 2,
  transform: 'none',
});

const Body = styled('p')({
  ...typeToken('h5-regular'),
  margin: 0,
  color: 'var(--gray)',
});

const StepLink = styled('a')({
  ...typeToken('h6-semi'),
  color: 'var(--primary)',
  textDecoration: 'underline',
  textUnderlinePosition: 'from-font',
  '&:hover': { color: 'var(--primary-hover)' },
  ...focusRing,
});

const LinkLine = styled('span')({
  display: 'block',
  marginTop: 10,
});

export { Area, Art, ArtBox, Body, Column, Floor, LinkLine, Scenery, StepLink };
