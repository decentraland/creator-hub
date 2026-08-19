import { Box, styled } from 'decentraland-ui2';

const Panel = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: theme.spacing(45),
  flex: '0 0 auto',
  height: '100%',
  borderLeft: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  overflow: 'hidden',
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 1, 1, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  minHeight: theme.spacing(6),
}));

const HeaderTitle = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  fontWeight: theme.typography.fontWeightBold,
  fontSize: theme.typography.body2.fontSize,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: theme.palette.text.secondary,
}));

const HeaderActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const Transcript = styled(Box)(({ theme }) => ({
  flex: '1 1 auto',
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
}));

const EmptyState = styled(Box)(({ theme }) => ({
  margin: 'auto',
  maxWidth: theme.spacing(34),
  textAlign: 'center',
  color: theme.palette.text.secondary,
  fontSize: theme.typography.body2.fontSize,
  lineHeight: 1.6,
}));

const UserBubble = styled(Box)(({ theme }) => ({
  alignSelf: 'flex-end',
  maxWidth: '88%',
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.spacing(1.5),
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  fontSize: theme.typography.body2.fontSize,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}));

const AssistantBubble = styled(Box)(({ theme }) => ({
  alignSelf: 'flex-start',
  maxWidth: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.75),
  fontSize: theme.typography.body2.fontSize,
  color: theme.palette.text.primary,
}));

const AssistantText = styled(Box)({
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  lineHeight: 1.6,
});

const ToolChip = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  alignSelf: 'flex-start',
  maxWidth: '100%',
  padding: theme.spacing(0.25, 1),
  borderRadius: theme.spacing(0.75),
  backgroundColor: theme.palette.action.hover,
  color: theme.palette.text.secondary,
  fontSize: theme.typography.caption.fontSize,
  fontFamily: 'monospace',
}));

const ToolDetail = styled('span')({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const ThinkingRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  color: theme.palette.text.secondary,
  fontSize: theme.typography.caption.fontSize,
}));

const ErrorRow = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.spacing(1),
  backgroundColor: theme.palette.error.dark,
  color: theme.palette.error.contrastText,
  fontSize: theme.typography.caption.fontSize,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}));

const Composer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-end',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5),
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const SetupBox = styled(Box)(({ theme }) => ({
  margin: 'auto',
  maxWidth: theme.spacing(38),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  color: theme.palette.text.secondary,
  fontSize: theme.typography.body2.fontSize,
  lineHeight: 1.6,
}));

const SetupStep = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
}));

const CommandLine = styled('pre')(({ theme }) => ({
  margin: 0,
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.spacing(0.75),
  backgroundColor: theme.palette.action.hover,
  color: theme.palette.text.primary,
  fontFamily: 'monospace',
  fontSize: theme.typography.caption.fontSize,
  overflowX: 'auto',
  whiteSpace: 'pre',
}));

const ProviderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

export {
  AssistantBubble,
  AssistantText,
  CommandLine,
  Composer,
  EmptyState,
  ErrorRow,
  HeaderActions,
  HeaderTitle,
  Panel,
  PanelHeader,
  ProviderRow,
  SetupBox,
  SetupStep,
  ThinkingRow,
  ToolChip,
  ToolDetail,
  Transcript,
  UserBubble,
};
