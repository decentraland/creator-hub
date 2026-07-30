import { Box, styled } from 'decentraland-ui2';

const AssistantText = styled('div')(({ theme }) => ({
  ...theme.typography.body2,
  alignSelf: 'stretch',
  color: theme.palette.text.primary,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}));

const ErrorLine = styled('div')(({ theme }) => ({
  ...theme.typography.caption,
  color: theme.palette.error.main,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}));

const InputArea = styled('form')(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-end',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5),
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const Messages = styled('div')(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
}));

const Panel = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: theme.spacing(48),
  flexShrink: 0,
  height: '100%',
  borderLeft: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
}));

const PanelHeader = styled('header')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1, 1, 1, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const Setup = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
}));

const StatusLine = styled('div')(({ theme }) => ({
  ...theme.typography.caption,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  color: theme.palette.text.secondary,
  fontStyle: 'italic',
}));

const ToolLine = styled('div')(({ theme }) => ({
  ...theme.typography.caption,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  color: theme.palette.text.secondary,
  wordBreak: 'break-all',
}));

const UserBubble = styled('div')(({ theme }) => ({
  ...theme.typography.body2,
  alignSelf: 'flex-end',
  maxWidth: '85%',
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.spacing(1.5),
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}));

export {
  AssistantText,
  ErrorLine,
  InputArea,
  Messages,
  Panel,
  PanelHeader,
  Setup,
  StatusLine,
  ToolLine,
  UserBubble,
};
