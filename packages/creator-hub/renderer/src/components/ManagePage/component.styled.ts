import { dclColors, styled, Typography } from 'decentraland-ui2';

const { neutral } = dclColors;

const Content = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3.75),
  width: '100%',
  paddingBottom: theme.spacing(12.5),
}));

const Panel = styled('div')({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  '& > .Loader': { flex: 1, height: 'auto' },
});

const Page = styled('main')({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
});

const Title = styled(Typography)({
  display: 'flex',
  alignItems: 'center',
  minHeight: 56,
  color: neutral.softWhite,
  '&[tabindex="-1"]:focus': { outline: 'none' },
}) as typeof Typography;

export { Content, Page, Panel, Title };
