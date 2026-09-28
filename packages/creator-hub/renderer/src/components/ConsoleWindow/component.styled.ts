import { Box, IconButton, styled } from 'decentraland-ui2';

const MONOSPACE = '"Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace';

const Root = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  width: '100vw',
  background: theme.palette.background.default,
  color: theme.palette.text.primary,
}));

const Header = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.5, 1),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const HeaderButton = styled(IconButton)(({ theme }) => ({
  color: theme.palette.text.secondary,
  '&:hover': {
    color: theme.palette.text.primary,
    background: theme.palette.action.hover,
  },
}));

const Logs = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: theme.spacing(0.5, 1.5),
  fontFamily: MONOSPACE,
  fontSize: 12,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  '& > span': {
    display: 'block',
  },
}));

const Placeholder = styled(Box)(({ theme }) => ({
  display: 'flex',
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.text.secondary,
  fontSize: 13,
}));

export { Header, HeaderButton, Logs, Placeholder, Root };
