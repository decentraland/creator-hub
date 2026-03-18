import { Alert, styled } from 'decentraland-ui2';

const StyledAlert = styled(Alert)(({ theme }) => ({
  '&&': {
    alignItems: 'flex-start',
  },
  maxWidth: 700,
  '& .MuiAlert-icon': {
    marginTop: theme.spacing(0.25),
  },
  '& .MuiAlert-action': {
    paddingTop: 0,
  },
  '& .MuiAlert-message': {
    overflow: 'hidden',
  },
}));

const StyledDescription = styled('pre')(({ theme }) => ({
  maxHeight: 120,
  overflowY: 'auto',
  margin: 0,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: theme.typography.caption.fontSize,
  opacity: 0.9,
}));

export { StyledAlert, StyledDescription };
