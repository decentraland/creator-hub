import { styled } from 'decentraland-ui2';

import { typeToken } from '../tokens';

const STATS_BELOW = '@media (max-width: 1380.97px)';

const Panel = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 30,
});

const List = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

const Entry = styled('article')({
  display: 'flex',
  alignItems: 'center',
  gap: 20,
  minHeight: 118,
  boxSizing: 'border-box',
  backgroundColor: 'var(--palette-whiteTransparent-faint)',
  border: '1px solid var(--palette-whiteTransparent-subtle)',
  borderRadius: 'var(--shape-borderRadiusLarge)',
  overflow: 'hidden',
  [STATS_BELOW]: { flexWrap: 'wrap', rowGap: 0 },
});

const Thumbnail = styled('img')({
  width: 206,
  height: 116,
  flexShrink: 0,
  objectFit: 'cover',
  borderRadius: 'var(--shape-borderRadiusLarge)',
  backgroundColor: 'var(--gray)',
});

const SceneData = styled('div')({
  flex: 1,
  minWidth: 240,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

const NameBlock = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gridTemplateRows: '24px auto',
  minWidth: 0,
});

const Name = styled('h2')({
  ...typeToken('h4-semi'),
  margin: 0,
  color: 'var(--palette-neutral-softWhite)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const Where = styled('span')({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  minWidth: 0,
  fontSize: 14,
  fontWeight: 400,
  lineHeight: 1.5,
  color: 'var(--dcl-silver)',
  '& svg': { flexShrink: 0 },
});

const WhereText = styled('span')({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const Stats = styled('div')({
  padding: 9,
  [STATS_BELOW]: { flexBasis: '100%', paddingTop: 0 },
});

const StatsList = styled('dl')({
  display: 'flex',
  gap: 40,
  margin: 0,
  padding: 19,
  backgroundColor: 'var(--palette-blackTransparent-blurry)',
  border: '1px solid var(--palette-whiteTransparent-subtle)',
  borderRadius: 'var(--ui-radius)',
});

export {
  Entry,
  List,
  Name,
  NameBlock,
  Panel,
  SceneData,
  Stats,
  StatsList,
  Thumbnail,
  Where,
  WhereText,
};
