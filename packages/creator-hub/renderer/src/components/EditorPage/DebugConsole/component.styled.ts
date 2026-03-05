import { styled } from 'decentraland-ui2';

const Container = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  borderTop: '1px solid var(--dark-gray)',
  backgroundColor: 'var(--bg-inspector)',
});

const Header = styled('div')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 32,
  minHeight: 32,
  padding: '0 12px',
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
  cursor: 'default',
  userSelect: 'none',
});

const HeaderTitle = styled('span')({
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  color: 'var(--dcl-silver)',
  letterSpacing: '0.5px',
});

const HeaderControls = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const IconButton = styled('button')({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  padding: 0,
  border: 'none',
  borderRadius: 4,
  backgroundColor: 'transparent',
  color: 'var(--dcl-silver)',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  '&:disabled': {
    opacity: 0.3,
    cursor: 'default',
    '&:hover': {
      backgroundColor: 'transparent',
    },
  },
  '& svg': {
    width: 16,
    height: 16,
  },
});

const Logs = styled('div')({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '4px 12px',
  fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dcl-silver)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  '& span': {
    display: 'block',
  },
});

const Placeholder = styled('div')({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--dark-gray)',
  fontSize: 13,
});

export { Container, Header, HeaderControls, HeaderTitle, IconButton, Logs, Placeholder };
