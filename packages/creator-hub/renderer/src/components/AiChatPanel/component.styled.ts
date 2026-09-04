import { Box, IconButton, styled } from 'decentraland-ui2';

const Panel = styled(Box, {
  shouldForwardProp: prop => prop !== 'fill' && prop !== 'panelWidth',
})<{ fill?: boolean; panelWidth?: number }>(({ theme, fill, panelWidth }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: fill ? '100%' : panelWidth !== undefined ? `${panelWidth}px` : theme.spacing(45),
  flex: fill ? '1 1 auto' : '0 0 auto',
  height: '100%',
  borderLeft: fill ? 'none' : `1px solid ${theme.palette.divider}`,
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
  // minHeight:0 lets this flex child shrink below its content so it scrolls internally
  // instead of stretching the panel; overscrollBehavior:contain stops a scroll that hits
  // the top/bottom from chaining out to the editor behind it (#1501).
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  overscrollBehavior: 'contain',
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
  padding: theme.spacing(1.25, 1.75),
  // A dark neutral surface (not the brand red) — the new design makes user messages read as
  // quiet cards, letting the assistant's content and the red send button carry the accent.
  borderRadius: theme.spacing(2),
  backgroundColor: theme.palette.action.selected,
  color: theme.palette.text.primary,
  fontSize: theme.typography.body2.fontSize,
  lineHeight: 1.5,
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

const AssistantText = styled(Box)(({ theme }) => ({
  wordBreak: 'break-word',
  lineHeight: 1.6,
  fontSize: theme.typography.body2.fontSize,
  '& > *:first-child, & > div > *:first-child': { marginTop: 0 },
  '& > *:last-child, & > div > *:last-child': { marginBottom: 0 },
  '& p': { margin: theme.spacing(1, 0) },
  '& ul, & ol': { margin: theme.spacing(1, 0), paddingLeft: theme.spacing(2.5) },
  '& li': { marginTop: theme.spacing(0.25) },
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    margin: theme.spacing(1.5, 0, 0.75),
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: 1.25,
  },
  '& h1': { fontSize: theme.typography.body1.fontSize },
  '& h2, & h3, & h4, & h5, & h6': { fontSize: theme.typography.body2.fontSize },
  '& strong': { fontWeight: theme.typography.fontWeightBold },
  '& a': { color: theme.palette.primary.main, textDecoration: 'underline' },
  '& code': {
    fontFamily: 'monospace',
    fontSize: theme.typography.caption.fontSize,
    backgroundColor: theme.palette.action.hover,
    padding: theme.spacing(0.25, 0.5),
    borderRadius: theme.spacing(0.5),
  },
  '& pre': {
    margin: theme.spacing(1, 0),
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.spacing(0.75),
    backgroundColor: theme.palette.action.hover,
    overflowX: 'auto',
  },
  '& pre code': { padding: 0, backgroundColor: 'transparent' },
  '& blockquote': {
    margin: theme.spacing(1, 0),
    paddingLeft: theme.spacing(1.5),
    borderLeft: `1px solid ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
  },
}));

// Interactive `ask_user` prompt block, rendered inline in the transcript.
const PromptBox = styled(Box)(({ theme }) => ({
  alignSelf: 'stretch',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5),
  borderRadius: theme.spacing(1.5),
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.action.hover,
}));

const PromptQuestion = styled(Box)(({ theme }) => ({
  fontSize: theme.typography.body2.fontSize,
  fontWeight: theme.typography.fontWeightMedium,
  color: theme.palette.text.primary,
  lineHeight: 1.5,
}));

const PromptOptions = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.75),
}));

const PromptOption = styled('button', {
  shouldForwardProp: prop => prop !== 'selected',
})<{ selected?: boolean }>(({ theme, selected }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: theme.spacing(0.25),
  width: '100%',
  textAlign: 'left',
  padding: theme.spacing(1, 1.25),
  borderRadius: theme.spacing(1),
  border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
  backgroundColor: selected ? theme.palette.action.selected : theme.palette.background.paper,
  color: theme.palette.text.primary,
  fontFamily: 'inherit',
  fontSize: theme.typography.body2.fontSize,
  cursor: 'pointer',
  '&:hover:not(:disabled)': {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.selected,
  },
  '&:disabled': { cursor: 'default', opacity: 0.6 },
}));

const PromptOptionDesc = styled('span')(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.caption.fontSize,
  fontWeight: theme.typography.fontWeightRegular,
}));

const PromptOtherRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-end',
  gap: theme.spacing(1),
}));

const PromptAnswer = styled(Box)(({ theme }) => ({
  alignSelf: 'flex-start',
  padding: theme.spacing(0.75, 1.25),
  borderRadius: theme.spacing(1),
  backgroundColor: theme.palette.action.selected,
  color: theme.palette.text.primary,
  fontSize: theme.typography.body2.fontSize,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}));

const PromptNote = styled('span')(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.caption.fontSize,
}));

const AssistantImage = styled('img')(({ theme }) => ({
  maxWidth: '100%',
  borderRadius: theme.spacing(1),
  border: `1px solid ${theme.palette.divider}`,
  alignSelf: 'flex-start',
}));

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

const HistoryList = styled(Box)(({ theme }) => ({
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.25),
  padding: theme.spacing(1),
}));

const HistoryBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 1, 1),
  color: theme.palette.text.secondary,
  fontSize: theme.typography.caption.fontSize,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}));

const HistoryRow = styled(Box, { shouldForwardProp: prop => prop !== 'current' })<{
  current?: boolean;
}>(({ theme, current }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.spacing(1),
  cursor: 'pointer',
  backgroundColor: current ? theme.palette.action.selected : 'transparent',
  '&:hover': { backgroundColor: theme.palette.action.hover },
}));

const SessionText = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
});

const SessionTitle = styled('span')({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const SessionWhen = styled('span')(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.caption.fontSize,
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

const SetupAlt = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

const SetupDivider = styled('hr')(({ theme }) => ({
  width: '100%',
  border: 'none',
  borderTop: `1px solid ${theme.palette.divider}`,
  margin: theme.spacing(0.5, 0),
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

// The row of pill controls under the header: the chat/session picker on the left, the agent
// picker on the right. No bottom border — the transcript flows straight under it.
const Toolbar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5, 2, 0.5),
}));

// A dark rounded pill used for the toolbar controls (New Chat menu + agent select), matching
// the CODE/PREVIEW pills in the editor top bar but on the panel's darker surface.
const ToolbarPill = styled('button')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  minWidth: 0,
  flex: '0 1 auto',
  height: theme.spacing(4),
  padding: theme.spacing(0, 1.25),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(3),
  backgroundColor: theme.palette.action.hover,
  color: theme.palette.text.primary,
  fontSize: theme.typography.body2.fontSize,
  fontFamily: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  '&:hover': { backgroundColor: theme.palette.action.selected },
  '&:disabled': { opacity: 0.5, cursor: 'default' },
}));

const ToolbarPillLabel = styled('span')({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

// The circular accent send button in the composer (red with a white up-arrow).
const SendButton = styled(IconButton)(({ theme }) => ({
  flexShrink: 0,
  width: theme.spacing(4.5),
  height: theme.spacing(4.5),
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  '&:hover': { backgroundColor: theme.palette.primary.dark },
  '&.Mui-disabled': { backgroundColor: theme.palette.action.disabledBackground },
}));

const ProviderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const ProviderOption = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1.5),
  width: '100%',
}));

const ProviderHint = styled('span')(({ theme }) => ({
  flexShrink: 0,
  color: 'var(--dcl)',
  fontSize: theme.typography.pxToRem(11),
  fontWeight: 500,
}));

const ProviderValueHint = styled('span')(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(11),
}));

const BillingHint = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.5, 1.5),
  borderTop: `1px solid ${theme.palette.divider}`,
  color: theme.palette.text.primary,
  fontSize: theme.typography.pxToRem(11),
  lineHeight: 1.35,
}));

const BillingDismiss = styled('span')({
  textDecoration: 'underline',
  cursor: 'pointer',
  color: 'var(--dcl)',
});

const SelectionBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  padding: theme.spacing(0.75, 1.5),
  borderTop: `1px solid ${theme.palette.divider}`,
  color: theme.palette.text.secondary,
  fontSize: theme.typography.caption.fontSize,
}));

const SelectionNames = styled('span')({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const SelectionClear = styled('span')(({ theme }) => ({
  flexShrink: 0,
  textDecoration: 'underline',
  cursor: 'pointer',
  color: theme.palette.text.primary,
}));

export {
  AssistantBubble,
  AssistantImage,
  AssistantText,
  BillingDismiss,
  BillingHint,
  CommandLine,
  Composer,
  EmptyState,
  ErrorRow,
  HeaderActions,
  HeaderTitle,
  HistoryBar,
  HistoryList,
  HistoryRow,
  Panel,
  PanelHeader,
  PromptAnswer,
  PromptBox,
  PromptNote,
  PromptOption,
  PromptOptionDesc,
  PromptOptions,
  PromptOtherRow,
  PromptQuestion,
  ProviderHint,
  ProviderOption,
  ProviderRow,
  ProviderValueHint,
  SelectionBar,
  SelectionClear,
  SelectionNames,
  SendButton,
  SessionText,
  SessionTitle,
  SessionWhen,
  SetupAlt,
  SetupBox,
  SetupDivider,
  SetupStep,
  ThinkingRow,
  Toolbar,
  ToolbarPill,
  ToolbarPillLabel,
  ToolChip,
  ToolDetail,
  Transcript,
  UserBubble,
};
