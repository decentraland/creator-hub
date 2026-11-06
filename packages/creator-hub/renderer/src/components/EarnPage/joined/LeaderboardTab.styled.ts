import { styled } from 'decentraland-ui2';

import { typeToken } from '../tokens';

import { NewsPanel } from './NewsPanel';
import { PageBackdrop } from './parts.styled';

const STACKED = '@media (max-width: 1150px)';
const STUCK_TOP = 130;
const GRID = '80px minmax(260px, 600px) minmax(136px, 1fr) auto';

const Panel = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 30,
});

const Scrolldown = styled('div')({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 30,
  [STACKED]: { flexDirection: 'column', alignItems: 'stretch' },
});

const Places = styled('div')({
  '--cf-toolbar-h': '56px',
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
});

const Toolbar = styled(PageBackdrop)({
  position: 'sticky',
  top: STUCK_TOP,
  zIndex: 2,
});

const Table = styled('div')({
  display: 'flex',
  flexDirection: 'column',
});

const Head = styled(PageBackdrop)({
  position: 'sticky',
  top: `calc(${STUCK_TOP}px + var(--cf-toolbar-h))`,
  zIndex: 2,
  paddingTop: 30,
});

const Body = styled('div')({
  display: 'flex',
  flexDirection: 'column',
});

const HeaderRow = styled('div')({
  display: 'grid',
  gridTemplateColumns: GRID,
  alignItems: 'center',
  height: 36,
  padding: '0 20px',
  borderBottom: '1px solid var(--palette-whiteTransparent-soft)',
});

const HeaderCell = styled('span')({
  ...typeToken('h7-regular'),
  color: 'var(--gray)',
});

const Row = styled('div')({
  display: 'grid',
  gridTemplateColumns: GRID,
  alignItems: 'center',
  padding: '10px 20px 9px',
  borderBottom: '1px solid var(--palette-whiteTransparent-soft)',
  '& .JumpInCell': { opacity: 0, marginLeft: 16 },
  '&:hover, &:focus-within': { backgroundColor: 'var(--palette-whiteTransparent-subtle)' },
  '&:hover .JumpInCell, &:focus-within .JumpInCell': { opacity: 1 },
});

const Rank = styled('span')({
  ...typeToken('h6-semi'),
  display: 'flex',
  alignItems: 'center',
  height: 50,
  color: 'var(--palette-neutral-softWhite)',
});

const Medal = styled('span')({
  fontSize: 26,
  lineHeight: 'normal',
});

const PlaceCell = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
});

const Thumbnail = styled('img')({
  width: 89,
  height: 50,
  flexShrink: 0,
  objectFit: 'cover',
  borderRadius: 'var(--shape-borderRadiusMedium)',
  backgroundColor: 'var(--gray)',
});

const PlaceText = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
});

const PlaceName = styled('span')({
  ...typeToken('h6-semi'),
  color: 'var(--palette-neutral-softWhite)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const PlaceWhere = styled('span')({
  ...typeToken('h7-regular'),
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  color: 'var(--dcl-silver)',
  '& svg': { flexShrink: 0 },
});

const PlaceWhereText = styled('span')({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const Earned = styled('span')({
  ...typeToken('h6-semi'),
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--palette-neutral-softWhite)',
  whiteSpace: 'nowrap',
});

const News = styled(NewsPanel)({
  position: 'sticky',
  top: STUCK_TOP,
  flex: '0 0 clamp(360px, calc(100% - 665px), 500px)',
  [STACKED]: { position: 'static', flex: 'none', width: '100%' },
});

export {
  Body,
  Earned,
  Head,
  HeaderCell,
  HeaderRow,
  Medal,
  News,
  Panel,
  PlaceCell,
  PlaceName,
  PlaceText,
  PlaceWhere,
  PlaceWhereText,
  Places,
  Rank,
  Row,
  Scrolldown,
  Table,
  Thumbnail,
  Toolbar,
};
