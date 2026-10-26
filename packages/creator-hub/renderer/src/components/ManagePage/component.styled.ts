import { dclColors, styled, Typography } from 'decentraland-ui2';

const { neutral } = dclColors;

const Content = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3.75),
  width: '100%',
  paddingBottom: theme.spacing(12.5),
}));

const Title = styled(Typography)({
  display: 'flex',
  alignItems: 'center',
  minHeight: 56,
  color: neutral.softWhite,
}) as typeof Typography;

export { Content, Title };
