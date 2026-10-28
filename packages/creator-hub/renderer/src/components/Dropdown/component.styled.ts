import { dclColors, IconButton, Menu, styled } from 'decentraland-ui2';
import type { Theme } from 'decentraland-ui2';

const { blackTransparent, neutral, whiteTransparent } = dclColors;

const menuSurfaceStyles = ({ theme }: { theme: Theme }) => ({
  '& .MuiPaper-root': {
    backgroundColor: 'var(--palette-neutral-onyx)',
    backgroundImage: 'none',
    borderRadius: '12px',
    boxShadow: `inset 0 0 0 1px ${whiteTransparent.subtle}, 0 4px 8px ${blackTransparent.blurry}`,
  },
  '& .MuiMenu-list': {
    padding: theme.spacing(1.25, 0),
  },
  '& .MuiMenuItem-root': {
    minHeight: '38px',
    margin: theme.spacing(0, 1.25),
    padding: theme.spacing(0, 1.25),
    borderRadius: '8px',
    gap: theme.spacing(1.25),
    color: neutral.softWhite,
    '& svg': {
      flexShrink: 0,
      fontSize: theme.typography.pxToRem(16),
    },
    '& .MenuGlyph': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 16px',
      width: 16,
      height: 16,
      overflow: 'visible',
    },
    '&.Danger .MenuGlyph svg': { color: theme.palette.error.main },
    '&.Mui-focusVisible': {
      backgroundColor: 'transparent',
    },
    '&:hover, &.Mui-focusVisible:hover': {
      backgroundColor: neutral.gray0,
    },
    '&:active': {
      backgroundColor: neutral.gray0,
      backgroundImage: `linear-gradient(${whiteTransparent.subtle}, ${whiteTransparent.subtle})`,
    },
    '&.Mui-disabled': {
      opacity: 1,
      color: whiteTransparent.blurry,
      '& svg': { opacity: 0.4 },
    },
  },
  '&.ArrowKeyed .MuiMenuItem-root.Mui-focusVisible': {
    backgroundColor: neutral.gray0,
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: -2,
  },
});

const dropdownRowStyles = ({ theme }: { theme: Theme }) => ({
  '& .MuiPaper-root': {
    minWidth: '230px',
  },
  '& .MuiMenuItem-root': {
    fontSize: theme.typography.pxToRem(12),
    fontWeight: 400,
    lineHeight: 1,
    '& svg': { color: neutral.gray3 },
    '&.Mui-selected': { backgroundColor: 'transparent' },
  },
});

const MenuSeparator = styled('li')(({ theme }) => ({
  height: 1,
  margin: theme.spacing(1.25, 0),
  backgroundColor: whiteTransparent.subtle,
  listStyle: 'none',
}));

const StyledMenu = styled(Menu)(menuSurfaceStyles, dropdownRowStyles);

const Trigger = styled(IconButton, {
  shouldForwardProp: prop => prop !== 'look',
})<{ look: 'ghost' | 'filled' }>(({ theme, look }) => ({
  width: 40,
  backgroundColor: look === 'filled' ? whiteTransparent.subtle : 'transparent',
  height: 40,
  borderRadius: 100,
  color: whiteTransparent.blurry,
  '& svg': { fontSize: theme.typography.pxToRem(20) },
  '&:hover, &:focus-visible, &[aria-expanded="true"]': {
    backgroundColor: whiteTransparent.subtle,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

export { menuSurfaceStyles, MenuSeparator, StyledMenu, Trigger };
