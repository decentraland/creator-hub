import { dclColors, styled } from 'decentraland-ui2';

import { DomainSelect } from '../DetailsTab/DetailsTab.styled';

const { neutral, whiteTransparent } = dclColors;

const listGrid = {
  display: 'grid',
  gridTemplateColumns: '524px 200px minmax(0, 1fr) 30px',
  columnGap: 10,
  alignItems: 'center',
} as const;

const AddButton = styled('span')(({ theme }) => ({
  '&& .MuiButton-root.MuiButton-sizeSmall': {
    height: 26,
    minWidth: 0,
    padding: theme.spacing(0.25, 0.75),
    borderRadius: 6,
    gap: theme.spacing(0.75),
    fontSize: theme.typography.pxToRem(12),
    fontWeight: 600,
    letterSpacing: 0,
  },
  '&& .MuiButton-root.Mui-disabled': { opacity: 0.2 },
  '&& .MuiButton-root .MuiButton-startIcon': { margin: 0 },
  '&& .MuiButton-root .MuiButton-startIcon > *:nth-of-type(1)': {
    fontSize: '23.14px',
    margin: '-2.57px',
  },
}));

const AddBlock = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.25),
  width: 700,
  maxWidth: '100%',
}));

const AddRow = styled('div')({
  width: '100%',
  '&& .MuiInputBase-root': { paddingRight: 7 },
});

const Description = styled('p')(({ theme }) => ({
  margin: 0,
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(16),
  lineHeight: theme.typography.pxToRem(19),
}));

const ListHeader = styled('div')(({ theme }) => ({
  ...listGrid,
  height: 40,
  padding: theme.spacing(0, 1.25),
  borderBottom: `1px solid ${whiteTransparent.soft}`,
  color: neutral.gray4,
  fontSize: theme.typography.pxToRem(14),
  lineHeight: 1,
  '& > .Lead': { display: 'flex', alignItems: 'center', gap: theme.spacing(1.25) },
  '& .Selected': { color: neutral.softWhite, fontWeight: 600 },
}));

const ListBlock = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
}));

const Root = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(5),
  paddingTop: theme.spacing(1.125),
}));

const ParcelSelect = styled(DomainSelect)({
  '&&': { width: 200 },
  '&& .MuiSelect-icon': { color: whiteTransparent.blurry },
});

const Row = styled('li')(({ theme }) => ({
  ...listGrid,
  padding: theme.spacing(1.25),
  boxShadow: `inset 0 -1px 0 ${whiteTransparent.soft}`,
  '& > .Lead': {
    gridColumn: 1,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    minWidth: 0,
  },
  '& > .Scope': { gridColumn: 2 },
  '& > .Note': { gridColumn: 3, justifySelf: 'end' },
  '& .Who .MuiAvatar-root': { width: 28, height: 28, margin: 2 },
  '& .Who .Avatar .Paragraph .Name': {
    display: 'inline-block',
    maxWidth: 230,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    verticalAlign: 'bottom',
    color: neutral.softWhite,
    fontSize: theme.typography.pxToRem(16),
    fontWeight: 600,
  },
  '& > .Trash': {
    gridColumn: 4,
    width: 30,
    height: 30,
    padding: theme.spacing(0.75),
    borderRadius: 100,
    opacity: 0,
    color: neutral.gray3,
    '& svg': { width: 18, height: 18 },
    '&:hover': { backgroundColor: whiteTransparent.subtle },
  },
  '&:hover, &:focus-within': { backgroundColor: whiteTransparent.subtle },
  '&:hover > .Trash, &:focus-within > .Trash': { opacity: 1 },
  '& .MuiIconButton-root:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const Rows = styled('ul')({
  margin: 0,
  padding: 0,
  listStyle: 'none',
});

export {
  AddBlock,
  AddButton,
  AddRow,
  Description,
  ListBlock,
  ListHeader,
  ParcelSelect,
  Root,
  Row,
  Rows,
};
