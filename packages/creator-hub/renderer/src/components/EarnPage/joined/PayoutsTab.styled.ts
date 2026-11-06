import { Button, styled } from 'decentraland-ui2';

import { CopyToClipboard } from '../../CopyToClipboard';

import { focusRing, fontFace, typeToken } from '../tokens';

const GRID = 'repeat(4, minmax(0, 1fr)) 110px';
const GUTTER = 'clamp(16px, 5.104vw, 98px)';
const HIDE_ART = '@media (max-width: 1377.1px), (max-height: 708.2px)';

const Panel = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 30,
});

const CardsRow = styled('div')({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  alignItems: 'stretch',
  gap: 30,
  '& > *': { flex: 1, minWidth: 0 },
});

const Card = styled('section')({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  padding: 20,
  backgroundColor: 'var(--palette-whiteTransparent-faint)',
  border: '1px solid var(--palette-whiteTransparent-subtle)',
  borderRadius: 'var(--shape-borderRadiusXLarge)',
});

const CardHeader = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  minHeight: 24,
});

const CardTitle = styled('h2')({
  ...typeToken('h5-semi'),
  margin: 0,
  color: 'var(--palette-neutral-softWhite)',
  borderRadius: 'var(--shape-borderRadiusMedium)',
  '&:focus:not(:focus-visible)': { outline: 'none' },
  ...focusRing,
});

const cornerButton = {
  position: 'absolute' as const,
  top: 19,
  right: 19,
  minWidth: 0,
  height: 34.5,
  boxSizing: 'border-box' as const,
  padding: '10px 20px',
  borderRadius: 'var(--ui-radius)',
  boxShadow: 'none',
};

const CornerButton = styled(Button)({
  '&&&': {
    ...cornerButton,
    ...typeToken('h8-semi'),
    textTransform: 'uppercase',
    color: 'var(--palette-neutral-softWhite)',
    padding: '8.5px 18.5px',
    backgroundColor: 'transparent',
    border: '1.5px solid var(--palette-whiteTransparent-blurry)',
    ...focusRing,
  },
  '&&&:hover': { backgroundColor: 'var(--palette-whiteTransparent-subtle)' },
  '&&&&&&&:hover, &&&&&&&.Mui-focusVisible': { color: 'var(--palette-neutral-softWhite)' },
  '& .MuiTouchRipple-root': { display: 'none' },
});

const AddWalletButton = styled(Button)({
  '&&&': {
    ...cornerButton,
    ...typeToken('h8-semi'),
    position: 'static',
    alignSelf: 'flex-start',
    textTransform: 'uppercase',
    color: 'var(--palette-neutral-softWhite)',
    backgroundColor: 'var(--primary)',
    ...focusRing,
  },
  '&&&:hover': { backgroundColor: 'var(--primary-hover)' },
  '& .MuiTouchRipple-root': { display: 'none' },
});

const InfoGroup = styled('span')({
  display: 'inline-flex',
});

const LearnMore = styled('a')({
  ...typeToken('h7-semi'),
  fontWeight: 'var(--fw-bold)',
  color: 'var(--palette-neutral-softWhite)',
  textDecoration: 'underline',
  cursor: 'pointer',
  ...focusRing,
});

const AddressChip = styled(CopyToClipboard)({
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  gap: 10,
  height: 32,
  padding: '0 10px',
  border: 0,
  borderRadius: 'var(--shape-borderRadiusMedium)',
  backgroundColor: 'var(--black-60)',
  color: 'var(--dropdown)',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  '& svg': { flexShrink: 0 },
  ...focusRing,
});

const Address = styled('span')({
  ...typeToken('h7-regular'),
  color: 'var(--pearl)',
});

const ContactValues = styled('div')({
  display: 'flex',
  gap: 10,
  '& > *': { flex: 1, minWidth: 0 },
});

const ContactValue = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
});

const ContactLabel = styled('span')({
  ...typeToken('h7-semi'),
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: 'var(--dcl-silver)',
  whiteSpace: 'nowrap',
});

const ContactText = styled('span')({
  ...typeToken('h6-semi'),
  color: 'var(--pearl)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const pill = {
  ...typeToken('h8-semi'),
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 'var(--r-pill)',
  border: '1px solid currentColor',
  whiteSpace: 'nowrap' as const,
};

const UnverifiedBadge = styled('span')({
  ...pill,
  gap: 4,
  padding: '2px 8px 2px 6px',
  color: 'var(--danger)',
  backgroundColor: 'var(--warning-bg)',
  '& svg': { width: 13, height: 13 },
});

const Table = styled('div')({
  display: 'flex',
  flexDirection: 'column',
});

const HeaderRow = styled('div')({
  display: 'grid',
  gridTemplateColumns: GRID,
  alignItems: 'center',
  height: 36,
  padding: '0 10px',
  borderBottom: '1px solid var(--palette-whiteTransparent-soft)',
});

const HeaderCell = styled('span')({
  ...typeToken('h7-regular'),
  color: 'var(--gray)',
  whiteSpace: 'nowrap',
  '&:last-of-type': { textAlign: 'center' },
});

const CycleRow = styled('div')({
  display: 'grid',
  gridTemplateColumns: GRID,
  alignItems: 'center',
  padding: '10px 10px 9px',
  borderBottom: '1px solid var(--palette-whiteTransparent-soft)',
  '& > *': { minWidth: 0 },
});

const CycleCell = styled('span')({
  display: 'flex',
  alignItems: 'center',
  height: 50,
});

const Disclosure = styled('button')({
  ...typeToken('h6-semi'),
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  maxWidth: '100%',
  padding: 0,
  border: 0,
  borderRadius: 'var(--shape-borderRadiusMedium)',
  backgroundColor: 'transparent',
  color: 'var(--palette-neutral-softWhite)',
  cursor: 'pointer',
  '& svg': { flexShrink: 0, color: 'var(--dcl-silver)' },
  ...focusRing,
});

const DisclosureLabel = styled('span')({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const StatusPill = styled('span')({
  ...pill,
  padding: '4px 8px 4px 6px',
  '&[data-status="pending"]': { color: 'var(--danger)', backgroundColor: 'var(--warning-bg)' },
  '&[data-status="paid"]': { color: 'var(--success)', backgroundColor: 'var(--success-bg)' },
});

const Figure = styled('span')({
  ...typeToken('h6-semi'),
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--palette-neutral-softWhite)',
  whiteSpace: 'nowrap',
});

const TransactionCell = styled('span')({
  display: 'flex',
  justifyContent: 'center',
});

const TransactionButton = styled('button')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  padding: 0,
  border: 0,
  borderRadius: 'var(--r-pill)',
  backgroundColor: 'transparent',
  color: 'var(--palette-whiteTransparent-blurry)',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: 'var(--palette-whiteTransparent-subtle)',
  },
  ...focusRing,
});

const PlaceRow = styled('div')({
  display: 'grid',
  gridTemplateColumns: GRID,
  alignItems: 'center',
  padding: '10px 10px 9px',
  backgroundColor: 'var(--palette-whiteTransparent-subtle)',
  borderBottom: '1px solid var(--palette-whiteTransparent-soft)',
  '& > *': { minWidth: 0 },
});

const PlaceSpan = styled('div')({
  gridColumn: '1 / 4',
  paddingLeft: 26,
  paddingRight: 100,
});

const EmptyPanel = styled(Panel)({
  minHeight: 'calc(100vh - 305px)',
});

const EmptyArea = styled('section')({
  '--g': GUTTER,
  '--s': `min(1, (100vw - 8px - (${GUTTER} + 823px) - clamp(32px, 6.667vw, 128px)) / 864px, (100vh - 466px) / 545px)`,
  position: 'relative',
  flex: 1,
  display: 'grid',
  gridTemplateRows: 'minmax(0, 125fr) auto minmax(0, 352fr)',
});

const EmptyArt = styled('img')({
  position: 'absolute',
  zIndex: 0,
  bottom: 'calc(10px * var(--s))',
  right: 'calc(-1 * var(--g))',
  width: 'calc(1361px * var(--s))',
  height: 'auto',
  pointerEvents: 'none',
  [HIDE_ART]: { display: 'none' },
});

const EmptyCopy = styled('div')({
  position: 'relative',
  zIndex: 1,
  gridRow: 2,
  marginLeft: 23,
  width: 'min(800px, calc(100% - 23px))',
  display: 'flex',
  flexDirection: 'column',
  gap: 30,
});

const EmptyHead = styled('div')({
  display: 'flex',
  flexDirection: 'column',
});

const EmptyTitle = styled('h2')({
  ...fontFace,
  fontSize: 'var(--fs-display)',
  fontWeight: 'var(--fw-bold)',
  lineHeight: 'normal',
  letterSpacing: 0,
  margin: 0,
  color: 'var(--palette-neutral-softWhite)',
});

const EmptyLine = styled('p')({
  ...typeToken('h3-semi'),
  margin: 0,
  width: 'fit-content',
  backgroundImage: 'linear-gradient(180deg, var(--primary), var(--lavender))',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  color: 'transparent',
});

const EmptyBody = styled('p')({
  ...typeToken('h5-regular'),
  margin: 0,
  color: 'var(--gray)',
});

const Notice = styled('div')({
  ...typeToken('h7-regular'),
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  height: 44,
  boxSizing: 'border-box',
  padding: '12px 16px 12px 12px',
  borderRadius: 'var(--shape-borderRadiusLarge)',
  backgroundColor: 'var(--darker-gray)',
  color: 'var(--palette-neutral-softWhite)',
  '& svg': { flexShrink: 0, color: 'var(--success)' },
});

export {
  AddWalletButton,
  Address,
  AddressChip,
  Card,
  CardHeader,
  CardTitle,
  CardsRow,
  ContactLabel,
  ContactText,
  ContactValue,
  ContactValues,
  CornerButton,
  CycleCell,
  CycleRow,
  Disclosure,
  DisclosureLabel,
  EmptyArea,
  EmptyArt,
  EmptyBody,
  EmptyCopy,
  EmptyHead,
  EmptyLine,
  EmptyPanel,
  EmptyTitle,
  Figure,
  HeaderCell,
  HeaderRow,
  InfoGroup,
  LearnMore,
  Notice,
  Panel,
  PlaceRow,
  PlaceSpan,
  StatusPill,
  Table,
  TransactionButton,
  TransactionCell,
  UnverifiedBadge,
};
