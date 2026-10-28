import { dclColors, styled } from 'decentraland-ui2';

import { Bar } from '../../ManagePage/ViewBar';

const { neutral, whiteTransparent } = dclColors;

const Actions = styled('td')(({ theme }) => ({
  whiteSpace: 'nowrap',
  '&&': { paddingRight: theme.spacing(2.5) },
  '& > .Actions': {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(2.5),
    opacity: 0,
  },
  '& .MuiIconButton-root': {
    width: 30,
    height: 30,
    padding: theme.spacing(0.75),
    borderRadius: 100,
    color: neutral.gray3,
    '& svg': { fontSize: theme.typography.pxToRem(18) },
    '&:hover': { backgroundColor: whiteTransparent.soft },
  },
  '& .MuiIconButton-root.Unpublish': { color: theme.palette.error.main },
  '& .MuiIconButton-root:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const Bulk = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(14),
  fontWeight: 600,
}));

const Meta = styled('span')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  color: neutral.gray3,
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 600,
  whiteSpace: 'nowrap',
  '& svg': { fontSize: theme.typography.pxToRem(18), flexShrink: 0 },
  '& > .Loader': { width: 'auto', height: 'auto', flexShrink: 0 },
}));

const Root = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3.75),
}));

const SceneName = styled('span')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2.5),
  maxWidth: '100%',
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 600,
  '& img, & .image-fallback-placeholder': {
    width: 50,
    height: 50,
    flexShrink: 0,
    borderRadius: 8,
    objectFit: 'cover',
  },
  '& > span': {
    flex: 1,
    width: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}));

const ScenesBar = styled(Bar)(({ theme }) => ({
  '&&&': { padding: theme.spacing(0, 1.25, 0, 2.5) },
}));

const Stats = styled('div')(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2.5),
  '& > span': {
    gap: theme.spacing(0.625),
    fontSize: theme.typography.pxToRem(16),
    fontWeight: 400,
  },
  '& > span > .LandsGlyph': { padding: 2, boxSizing: 'content-box' },
}));

const UpdatedAt = styled('time')(({ theme }) => ({
  borderRadius: 4,
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const Deployer = styled('span')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  minWidth: 0,
  maxWidth: '100%',
  color: neutral.gray3,
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 600,
  '& > .MuiAvatar-root': { flexShrink: 0 },
  '& > span': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
}));

const Table = styled('table')(({ theme }) => ({
  width: '100%',
  tableLayout: 'fixed',
  borderCollapse: 'separate',
  borderSpacing: 0,
  '& th, & td': {
    boxSizing: 'border-box',
    padding: 0,
    boxShadow: `inset 0 -1px 0 ${whiteTransparent.soft}`,
  },
  '& th': {
    height: 40,
    color: neutral.gray4,
    fontSize: theme.typography.pxToRem(14),
    fontWeight: 400,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  '& td': { height: 70 },
  '& th .SortArrow': {
    marginLeft: theme.spacing(1.25),
    verticalAlign: 'middle',
    color: theme.palette.primary.main,
  },
  '& tbody::before': { content: '""', display: 'table-row', height: 20 },
  '& th.Select, & td.Select': { width: 60, padding: theme.spacing(0, 2.5) },
  '& th.Name': { width: 660 },
  '& tr > th.Name:first-child': { width: 720 },
  '& tr > :first-child:not(.Select)': { paddingLeft: theme.spacing(2.5) },
  '& th.Actions': { width: 100 },
  '& td.Select > .MuiCheckbox-root': { display: 'flex' },
  '& tbody tr:hover, & tbody tr:focus-within, & tbody tr.Selected': {
    backgroundColor: whiteTransparent.subtle,
  },
  '& tbody tr:hover .Actions, & tbody tr:focus-within .Actions, & tbody tr .Actions.Running': {
    opacity: 1,
  },
  [theme.breakpoints.down(1920)]: {
    tableLayout: 'auto',
    '& th:not(.Select):not(.Name):not(.Actions)': { width: 226 },
  },
}));

export { Actions, Bulk, Deployer, Meta, Root, SceneName, ScenesBar, Stats, Table, UpdatedAt };
