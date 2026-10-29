import { styled } from 'decentraland-ui2';

const ErrorText = styled('span')(({ theme }) => ({
  marginTop: theme.spacing(1),
  color: theme.palette.error.main,
  fontSize: theme.typography.pxToRem(14),
}));

const Root = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  '& > [role="status"] > *': {
    marginTop: theme.spacing(1),
  },
}));

export { ErrorText, Root };
