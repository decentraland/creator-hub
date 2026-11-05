import { Button, Menu, styled } from 'decentraland-ui2';

import { ICON_ONLY_QUERY } from './breakpoints';

const focusRingInset = {
  outline: '2px solid var(--palette-info-light)',
  outlineOffset: -2,
};

const StyledButtonRow = styled('div')(() => ({
  display: 'flex',
  alignItems: 'center',
  borderRadius: 12,
  overflow: 'hidden',
}));

const StyledLabelButton = styled(Button)(({ theme }) => ({
  '&&&': {
    minWidth: 0,
    height: 40,
    margin: 0,
    padding: `0 ${theme.spacing(1.75)}`,
    gap: theme.spacing(0.75),
    fontSize: 16,
    fontWeight: 600,
    lineHeight: '22px',
    letterSpacing: 0,
    fontOpticalSizing: 'none',
    '& .MuiButton-startIcon': { margin: 0 },
    '& .MuiButton-startIcon > *:nth-of-type(1)': { fontSize: 18 },
    textTransform: 'uppercase',
    borderRadius: 0,
    backgroundColor: theme.palette.primary.main,
    color: 'var(--text-on-primary)',
    boxShadow: 'none',
    [`@media ${ICON_ONLY_QUERY}`]: {
      width: 40,
      minWidth: 40,
      padding: 0,
      gap: 0,
    },
  },
  '&&&&&&:hover': {
    backgroundColor: 'var(--dcl-hover)',
    boxShadow: 'none',
  },
  '&&&:focus-visible': focusRingInset,
}));

const StyledLabelText = styled('span')({
  [`@media ${ICON_ONLY_QUERY}`]: {
    position: 'absolute',
    width: 1,
    height: 1,
    margin: -1,
    padding: 0,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
    border: 0,
  },
});

const StyledToggleButton = styled(Button)(({ theme }) => ({
  '&&&': {
    width: 40,
    minWidth: 40,
    height: 40,
    margin: 0,
    padding: 0,
    borderRadius: 0,
    backgroundColor: theme.palette.primary.main,
    borderLeft: '1px solid var(--palette-whiteTransparent-soft)',
    boxShadow: 'none',
  },
  '&&&&&&:hover': {
    backgroundColor: 'var(--dcl-hover)',
    boxShadow: 'none',
  },
  '&&&:focus-visible': focusRingInset,
}));

const StyledMenu = styled(Menu)(({ theme }) => ({
  '& .MuiPaper-root': {
    backgroundColor: 'var(--menu-bg)',
    backgroundImage: 'none',
    borderRadius: 12,
    minWidth: 217,
    marginTop: theme.spacing(0.5),
    boxShadow: 'var(--menu-shadow)',
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

export { StyledButtonRow, StyledLabelButton, StyledLabelText, StyledMenu, StyledToggleButton };
