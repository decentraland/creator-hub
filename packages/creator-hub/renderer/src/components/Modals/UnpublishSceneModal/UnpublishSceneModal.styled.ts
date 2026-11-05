import { dclColors, styled } from 'decentraland-ui2';

const { neutral } = dclColors;

const ErrorText = styled('p')(({ theme }) => ({
  margin: 0,
  color: theme.palette.error.main,
  fontSize: theme.typography.pxToRem(14),
}));

const Notice = styled('p')(({ theme }) => ({
  margin: 0,
  color: neutral.gray4,
  fontSize: theme.typography.pxToRem(16),
  lineHeight: 'normal',
}));

const Progress = styled('p')(({ theme }) => ({
  margin: 0,
  color: neutral.gray3,
  fontSize: theme.typography.pxToRem(14),
}));

export { ErrorText, Notice, Progress };
