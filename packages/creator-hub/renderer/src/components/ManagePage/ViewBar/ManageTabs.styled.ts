import { dclColors, styled } from 'decentraland-ui2';

const { neutral, whiteTransparent } = dclColors;

const Tab = styled('button')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(1.25),
  height: 36,
  padding: theme.spacing(1, 2),
  borderRadius: 100,
  border: `1px solid ${whiteTransparent.subtle}`,
  boxShadow: `inset 0 0 0 0.5px ${whiteTransparent.subtle}`,
  backgroundColor: 'transparent',
  color: whiteTransparent.backdrop,
  fontFamily: theme.typography.fontFamily,
  fontSize: theme.typography.pxToRem(14),
  fontWeight: 600,
  lineHeight: 1,
  textTransform: 'uppercase',
  cursor: 'pointer',
  '& svg': {
    fontSize: theme.typography.pxToRem(20),
    opacity: 0.6,
  },
  '&:hover': {
    borderColor: whiteTransparent.blurry,
    boxShadow: `inset 0 0 0 0.5px ${whiteTransparent.blurry}`,
  },
  '&[aria-selected="true"]': {
    border: 'none',
    boxShadow: 'none',
    backgroundColor: whiteTransparent.subtle,
    color: neutral.softWhite,
    '& svg': { opacity: 1 },
  },
  '&[aria-selected="true"]:hover': {
    backgroundColor: whiteTransparent.soft,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const TabList = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.25),
}));

export { Tab, TabList };
