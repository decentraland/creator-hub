import { dclColors, styled, Tabs } from 'decentraland-ui2';

const { neutral, whiteTransparent } = dclColors;

const Content = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3.75),
  width: '100%',
  paddingBottom: theme.spacing(12.5),
  '& > .Loader': { flex: 1, height: 'auto' },
}));

const Header = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: theme.spacing(3),
  minHeight: 56,
}));

const HeaderActions = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2.5),
  flexShrink: 0,
  paddingTop: theme.spacing(1),
  '&&&&&&& .MuiButton-root': {
    height: 40,
    margin: 0,
    padding: theme.spacing(1, 3),
    borderRadius: 12,
    fontSize: theme.typography.pxToRem(16),
    fontWeight: 600,
    lineHeight: theme.typography.pxToRem(24),
    textTransform: 'uppercase',
  },
}));

const OwnerName = styled('span')(({ theme }) => ({
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 600,
}));

const SelfOwner = styled('span')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
}));

const Page = styled('main')({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
});

const RoleRow = styled('dl')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2.5),
  minHeight: 28,
  margin: 0,
  padding: theme.spacing(0, 0.5),
  '& > div': {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  },
  '& dt': {
    color: neutral.gray3,
    fontSize: theme.typography.pxToRem(14),
  },
  '& dd': {
    display: 'flex',
    alignItems: 'center',
    margin: 0,
  },
  '& > div:last-child': { gap: theme.spacing(1.25) },
  '& dd .Avatar': { gap: theme.spacing(0.75) },
  '& dd .MuiAvatar-root': {
    boxSizing: 'border-box',
    width: 28,
    height: 28,
    border: `2px solid ${whiteTransparent.soft}`,
  },
  '& dd .Avatar .Paragraph span': {
    color: neutral.softWhite,
    fontSize: theme.typography.pxToRem(16),
    fontWeight: 600,
  },
}));

const TabBar = styled(Tabs)(({ theme }) => ({
  minHeight: 0,
  borderBottom: `1px solid ${whiteTransparent.soft}`,
  '& .MuiTabs-flexContainer': { gap: theme.spacing(5) },
  '& .MuiTabs-indicator': { height: 2, backgroundColor: neutral.softWhite },
  '& .MuiTab-root': {
    minWidth: 0,
    minHeight: 0,
    padding: theme.spacing(1.25, 0.5),
    color: neutral.gray3,
    fontSize: theme.typography.pxToRem(16),
    fontWeight: 600,
    lineHeight: theme.typography.pxToRem(19),
    letterSpacing: 0,
    textTransform: 'uppercase',
    '&:hover, &.Mui-selected': { color: neutral.softWhite },
    '&.Mui-focusVisible': {
      outline: `2px solid ${theme.palette.info.light}`,
      outlineOffset: -2,
    },
  },
}));

const TitleBlock = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.25),
  minWidth: 0,
}));

export { Content, Header, HeaderActions, OwnerName, Page, RoleRow, SelfOwner, TabBar, TitleBlock };
