import { Box, Typography, styled } from 'decentraland-ui2';

const Actions = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(2),
  marginTop: theme.spacing(1),
}));

const Description = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  maxWidth: theme.spacing(60),
}));

const PageFallback = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(2),
  minHeight: '100vh',
  padding: theme.spacing(4),
  textAlign: 'center',
}));

export { Actions, Description, PageFallback };
