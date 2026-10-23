import { Button, Menu, styled } from 'decentraland-ui2';

// A plain flex row, not MuiButtonGroup: the theme's ButtonGroup styling keeps each
// grouped button independently pill-shaped with a gap between them, which fights the
// single seamless-pill look this control needs. Zeroing each button's own radius below
// and letting this wrapper's radius + overflow:hidden define the shape avoids that.
const StyledButtonRow = styled('div')(() => ({
  display: 'flex',
  alignItems: 'center',
  borderRadius: 12,
  overflow: 'hidden',
}));

const StyledLabelButton = styled(Button)(({ theme }) => ({
  '&&&': {
    width: 130,
    height: 40,
    margin: 0,
    padding: `0 ${theme.spacing(1.75)}`,
    gap: theme.spacing(0.75),
    fontSize: 16,
    fontWeight: 600,
    textTransform: 'uppercase',
    borderRadius: 0,
    backgroundColor: theme.palette.primary.main,
    color: 'var(--text-on-primary)',
    boxShadow: 'none',
  },
  '&&&&&&:hover': {
    backgroundColor: 'var(--primary-hover)',
    boxShadow: 'none',
  },
}));

const StyledToggleButton = styled(Button)(({ theme }) => ({
  '&&&': {
    width: 40,
    minWidth: 40,
    height: 40,
    margin: 0,
    padding: 0,
    borderRadius: 0,
    backgroundColor: theme.palette.primary.main,
    borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: 'none',
  },
  '&&&&&&:hover': {
    backgroundColor: 'var(--primary-hover)',
    boxShadow: 'none',
  },
}));

const StyledMenu = styled(Menu)(({ theme }) => ({
  '& .MuiPaper-root': {
    backgroundColor: '#35333B',
    backgroundImage: 'none',
    borderRadius: 12,
    minWidth: 217,
    marginTop: theme.spacing(0.5),
    boxShadow: '0px 4px 8px 0px rgba(0, 0, 0, 0.4)',
  },
  '& .MuiList-root': {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
    padding: theme.spacing(1.25),
  },
  '& .MuiMenuItem-root': {
    height: 38,
    borderRadius: 8,
    padding: `0 ${theme.spacing(1.25)}`,
    gap: theme.spacing(2),
    fontSize: 14,
    color: 'var(--text)',
    '&:hover': {
      backgroundColor: 'var(--dark-gray)',
    },
  },
}));

export { StyledButtonRow, StyledLabelButton, StyledMenu, StyledToggleButton };
