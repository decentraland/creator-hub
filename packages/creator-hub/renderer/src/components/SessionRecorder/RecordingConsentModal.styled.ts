import { dclColors, styled } from 'decentraland-ui2';

const { neutral } = dclColors;

const ConsentList = styled('ul')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  margin: 0,
  paddingLeft: theme.spacing(2.5),
  color: neutral.gray4,
  fontSize: theme.typography.pxToRem(14),
  lineHeight: 1.45,
}));

export { ConsentList };
