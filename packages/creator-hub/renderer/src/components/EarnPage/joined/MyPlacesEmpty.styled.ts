import { styled } from 'decentraland-ui2';

import { focusRing, typeToken } from '../tokens';

const CARD_GAP = 'clamp(20px, 3.125vw, 60px)';

const column = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  textAlign: 'center' as const,
};

const NoScenesState = styled('section')({
  ...column,
  gap: 30,
  paddingTop: 200,
});

const UnpublishedState = styled('section')({
  ...column,
  gap: 60,
  paddingTop: 60,
});

const Header = styled('div')({
  ...column,
  gap: 16,
});

const Title = styled('h2')({
  ...typeToken('h2-semi'),
  margin: 0,
  color: 'var(--palette-neutral-softWhite)',
});

const Body = styled('p')({
  ...typeToken('h6-regular'),
  margin: 0,
  color: 'var(--dcl-silver)',
});

const Actions = styled('div')({
  display: 'flex',
  gap: 16,
});

const Scenes = styled('section')({
  ...column,
  alignSelf: 'stretch',
  gap: 30,
});

const ScenesHeading = styled('h3')({
  ...typeToken('h5-semi'),
  margin: 0,
  color: 'var(--palette-neutral-softWhite)',
});

const Cards = styled('div')({
  display: 'flex',
  justifyContent: 'center',
  gap: CARD_GAP,
  width: '100%',
});

const Card = styled('button')({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  width: `min(416px, calc((100% - 2 * ${CARD_GAP}) / 3))`,
  padding: 0,
  boxSizing: 'border-box',
  overflow: 'hidden',
  textAlign: 'left',
  color: 'inherit',
  backgroundColor: 'var(--palette-whiteTransparent-faint)',
  border: '1px solid var(--palette-whiteTransparent-subtle)',
  borderRadius: 'var(--shape-borderRadiusXLarge)',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: 'var(--palette-whiteTransparent-hover)',
    borderColor: 'transparent',
  },
  '&:active': { backgroundColor: 'var(--palette-whiteTransparent-subtle)' },
  ...focusRing,
});

const CardThumbnail = styled('img')({
  display: 'block',
  width: '100%',
  height: 'auto',
  aspectRatio: '416 / 273',
  objectFit: 'cover',
  borderRadius: 'var(--shape-borderRadiusXLarge)',
  backgroundColor: 'var(--gray)',
});

const CardText = styled('span')({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  height: 110,
  padding: 20,
  boxSizing: 'border-box',
});

const CardName = styled('span')({
  ...typeToken('h4-semi'),
  height: 24,
  color: 'var(--palette-neutral-softWhite)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const CardParcels = styled('span')({
  ...typeToken('h7-regular'),
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  height: 32,
  color: 'var(--dcl-silver)',
  '& svg': { flexShrink: 0 },
});

export {
  Actions,
  Body,
  Card,
  CardName,
  CardParcels,
  CardText,
  CardThumbnail,
  Cards,
  Header,
  NoScenesState,
  Scenes,
  ScenesHeading,
  Title,
  UnpublishedState,
};
