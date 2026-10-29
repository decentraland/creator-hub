import { dclColors, styled, Tabs } from 'decentraland-ui2';

import { DomainSelect } from '../../../LandDetailPage/DetailsTab/DetailsTab.styled';

const { brand, neutral, whiteTransparent } = dclColors;

const AccessSelect = styled(DomainSelect)(({ theme }) => ({
  '&&': { width: 700, maxWidth: '100%', height: 40 },
  '&& .MuiOutlinedInput-notchedOutline': { border: `1px solid ${whiteTransparent.blurry}` },
  '&&:has([aria-expanded="true"]) .MuiOutlinedInput-notchedOutline': {
    borderColor: neutral.softWhite,
  },
  '&&& .MuiSelect-select': { padding: theme.spacing(1.3125, 5, 1.3125, 2) },
  '&& .MuiSelect-icon': { color: whiteTransparent.blurry },
}));

const AddButtons = styled('div')(({ theme }) => ({
  display: 'flex',
  flexShrink: 0,
  gap: theme.spacing(1.25),
  '&& .MuiButton-root': {
    height: 46,
    minWidth: 95,
    padding: theme.spacing(0.25, 2.5),
    borderRadius: 12,
    gap: theme.spacing(0.75),
    fontSize: theme.typography.pxToRem(14),
    fontWeight: 600,
  },
  '&& .MuiButton-root + .MuiButton-root': { marginLeft: 0 },
  '&& .MuiButton-root .MuiButton-startIcon': { margin: 0 },
  '&& .MuiButton-root.Mui-disabled': { opacity: 0.2 },
}));

const AddRow = styled('div')(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1.125),
  width: 700,
  maxWidth: '100%',
  '& > .Field': { flex: 1, minWidth: 0 },
  '& > .Field .MuiInputBase-root': { height: 46 },
}));

const BrowseButton = styled('button')(({ theme }) => ({
  padding: 0,
  border: 0,
  background: 'none',
  cursor: 'pointer',
  color: theme.palette.primary.main,
  fontFamily: 'inherit',
  fontSize: theme.typography.pxToRem(16),
  textDecoration: 'underline',
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const Block = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.25),
}));

const CsvButton = styled('button', {
  shouldForwardProp: prop => prop !== 'tone',
})<{ tone: 'neutral' | 'primary' }>(({ theme, tone }) => ({
  height: 46,
  minWidth: 95,
  padding: theme.spacing(1.5, 2.5),
  border: 0,
  borderRadius: 12,
  backgroundColor: whiteTransparent.subtle,
  cursor: 'pointer',
  color: tone === 'primary' ? theme.palette.primary.main : neutral.softWhite,
  fontFamily: 'inherit',
  fontSize: theme.typography.pxToRem(14),
  fontWeight: 600,
  textTransform: 'uppercase',
  '&:hover': { backgroundColor: whiteTransparent.soft },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const CsvBlock = styled('div')({
  display: 'flex',
  flexDirection: 'column',
});

const DropZone = styled('div', {
  shouldForwardProp: prop => prop !== 'dragging',
})<{ dragging: 'over' | 'idle' }>(({ theme, dragging }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(0.5),
  width: 700,
  maxWidth: '100%',
  height: 46,
  borderRadius: 12,
  backgroundColor: whiteTransparent.subtle,
  boxShadow: dragging === 'over' ? `inset 0 0 0 1px ${neutral.softWhite}` : 'none',
  color: whiteTransparent.blurry,
  fontSize: theme.typography.pxToRem(16),
}));

const Empty = styled('p')(({ theme }) => ({
  margin: theme.spacing(2.5, 0, 0),
  color: neutral.gray4,
  fontSize: theme.typography.pxToRem(14),
}));

const FileName = styled('span')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.125),
  flex: 1,
  minWidth: 0,
  height: 46,
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(16),
  '& svg': { width: 24, height: 24, flexShrink: 0 },
  '& > span': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
}));

const InviteTabs = styled(Tabs)(({ theme }) => ({
  width: 700,
  maxWidth: '100%',
  minHeight: 0,
  boxShadow: `inset 0 -1px 0 ${whiteTransparent.soft}`,
  '& .MuiTabs-indicator': { height: 2, backgroundColor: neutral.softWhite },
  '& .MuiTab-root': {
    flex: 1,
    minHeight: 0,
    maxWidth: 'none',
    padding: theme.spacing(1.25, 0.5),
    color: neutral.gray3,
    fontSize: theme.typography.pxToRem(16),
    fontWeight: 600,
    letterSpacing: 0,
    textTransform: 'uppercase',
    '&.Mui-selected': { color: neutral.softWhite },
    '&.Mui-focusVisible': {
      outline: `2px solid ${theme.palette.info.light}`,
      outlineOffset: -2,
    },
  },
}));

const InviteBlock = styled(Block)(({ theme }) => ({
  gap: theme.spacing(2.5),
}));

const Invalid = styled('p')(({ theme }) => ({
  margin: 0,
  color: theme.palette.error.main,
  fontSize: theme.typography.pxToRem(16),
}));

const List = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: 700,
  maxWidth: '100%',
  '& > div, & li': { gridTemplateColumns: 'minmax(0, 1fr) 30px' },
  '& li > .Trash': { gridColumn: 2 },
  '& .BulkTrash': {
    width: 30,
    height: 30,
    padding: theme.spacing(0.75),
    borderRadius: 100,
    color: neutral.gray3,
    '& svg': { width: 18, height: 18 },
    '&:hover': { backgroundColor: whiteTransparent.subtle },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.info.light}`,
      outlineOffset: 2,
    },
  },
}));

const Results = styled('ul')(({ theme }) => ({
  position: 'absolute',
  zIndex: 2,
  top: 56,
  left: 0,
  width: 596,
  margin: 0,
  padding: theme.spacing(1.25, 0),
  listStyle: 'none',
  borderRadius: 12,
  border: `1px solid ${whiteTransparent.subtle}`,
  backgroundColor: 'var(--palette-neutral-onyx)',
  '& button': {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    width: `calc(100% - ${theme.spacing(2.5)})`,
    height: 38,
    margin: theme.spacing(0, 1.25),
    padding: theme.spacing(0, 1.25),
    border: 0,
    borderRadius: 8,
    background: 'none',
    cursor: 'pointer',
    color: neutral.softWhite,
    fontFamily: 'inherit',
    fontSize: theme.typography.pxToRem(16),
    textAlign: 'left',
    '&:hover, &:focus-visible': { backgroundColor: neutral.gray0, outline: 'none' },
  },
  '& img': { width: 24, height: 24, borderRadius: 4, objectFit: 'cover' },
}));

const Section = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3.75),
  '& > .ChangePassword': { marginTop: theme.spacing(-1.25), alignSelf: 'flex-start' },
  '& > .ChangePassword .MuiButton-root': {
    width: 192,
    height: 40,
    padding: theme.spacing(1, 3),
    borderRadius: 12,
    fontSize: theme.typography.pxToRem(14),
    fontWeight: 600,
    letterSpacing: 0,
    whiteSpace: 'nowrap',
  },
}));

const TypeDescription = styled('span')(({ theme }) => ({
  color: neutral.gray3,
  fontSize: theme.typography.pxToRem(14),
  fontWeight: 400,
}));

const TypeLabel = styled('span')(({ theme }) => ({
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 400,
  whiteSpace: 'pre',
}));

const Who = styled('span')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.25),
  minWidth: 0,
  '& .MuiAvatar-root, & img': {
    boxSizing: 'border-box',
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: `2px solid ${whiteTransparent.blurry}`,
    objectFit: 'cover',
  },
  '& .MuiAvatar-root': { backgroundColor: brand.lavander },
  '& > .Name': {
    maxWidth: 230,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: neutral.softWhite,
    fontSize: theme.typography.pxToRem(16),
    fontWeight: 600,
  },
}));

export {
  AccessSelect,
  AddButtons,
  AddRow,
  Block,
  BrowseButton,
  CsvBlock,
  CsvButton,
  DropZone,
  Empty,
  FileName,
  Invalid,
  InviteBlock,
  InviteTabs,
  List,
  Results,
  Section,
  TypeDescription,
  TypeLabel,
  Who,
};
