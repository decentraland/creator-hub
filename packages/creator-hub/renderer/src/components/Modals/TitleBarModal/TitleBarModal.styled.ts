import { dclColors, Dialog, IconButton, styled } from 'decentraland-ui2';

const { blackTransparent, neutral, rarity, whiteTransparent } = dclColors;

const Bar = styled('header')(({ theme }) => ({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 50,
  padding: theme.spacing(1.25, 2.5),
  backgroundColor: blackTransparent.soft,
  borderBottom: `1px solid ${whiteTransparent.subtle}`,
}));

const BarTitle = styled('h2')(({ theme }) => ({
  margin: 0,
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(18),
  fontWeight: 600,
  lineHeight: 'normal',
}));

const Body = styled('div')(({ theme }) => ({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(6.25),
  padding: theme.spacing(0, 10, 6.25),
}));

const CloseButton = styled(IconButton)(({ theme }) => ({
  width: 30,
  height: 30,
  borderRadius: 100,
  backgroundColor: whiteTransparent.subtle,
  color: neutral.softWhite,
  '& svg': { width: 18, height: 18 },
  '&:hover': { backgroundColor: whiteTransparent.soft },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const Frame = styled('div')(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(6.25),
  '&::before': {
    content: '""',
    position: 'absolute',
    zIndex: 0,
    left: '50%',
    bottom: -131.5,
    width: 824,
    height: 257.5,
    borderRadius: '50%',
    background: rarity.mythic,
    opacity: 0.3,
    filter: 'blur(500px)',
    transform: 'translateX(-50%) scaleY(-1)',
    pointerEvents: 'none',
  },
}));

const Panel = styled(Dialog)(({ theme }) => ({
  '& .MuiBackdrop-root': { backgroundColor: 'var(--dimmer)' },
  '& .MuiDialog-paper': {
    width: 'fit-content',
    maxWidth: 'calc(100vw - 32px)',
    margin: theme.spacing(2),
    overflow: 'hidden',
    borderRadius: 24,
    border: `1px solid ${whiteTransparent.subtle}`,
    backgroundColor: 'var(--modal-surface)',
    backgroundImage: 'none',
    boxShadow: 'none',
  },
}));

export { Bar, BarTitle, Body, CloseButton, Frame, Panel };
