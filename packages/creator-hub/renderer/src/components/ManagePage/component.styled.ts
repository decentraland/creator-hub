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

const Title = styled(Typography)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  minHeight: 56,
  marginBottom: theme.spacing(0.25),
  color: neutral.softWhite,
  lineHeight: theme.typography.pxToRem(56),
  '&[tabindex="-1"]:focus': { outline: 'none' },
})) as typeof Typography;

export { Content, Page, Panel, Title };
