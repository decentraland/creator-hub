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

// decentraland-ui2's theme overrides Button's radius via a 3-class compound selector
// (.css-hash.MuiButton-sizeMedium.MuiButton-containedPrimary), a global adjacent-
// sibling rule (.MuiButton-root + .MuiButton-root) adds a 10px gap between any two
// buttons in a row, and an even more specific hover rule
// (.css-hash.MuiButton-sizeMedium.MuiButton-containedPrimary:not(.Mui-disabled):not(.Mui-focusVisible):hover)
// sets the hover background. All three outrank a plain single-class override, so `&&&`
// (three chained classes) is needed for the base styles and `&&&&&&:hover` (six chained
// classes) for hover specifically, to actually win.
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
    backgroundColor: '#F70038',
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
    backgroundColor: '#F70038',
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
