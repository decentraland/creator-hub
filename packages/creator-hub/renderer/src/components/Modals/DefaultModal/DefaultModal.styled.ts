import { dclColors, Dialog, IconButton, styled } from 'decentraland-ui2';

const { blackTransparent, neutral, rarity, whiteTransparent } = dclColors;

const Actions = styled('div')(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2.5),
  '&& .MuiButton-root': {
    flex: '1 1 0',
    height: 46,
    margin: 0,
  },
}));

const Body = styled('div')(({ theme }) => ({
  color: neutral.gray4,
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 400,
  lineHeight: 'normal',
  '& b': { color: neutral.softWhite, fontWeight: 600 },
}));

const CloseButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  zIndex: 1,
  top: theme.spacing(2.5),
  right: theme.spacing(2.5),
  width: 36,
  height: 36,
  borderRadius: 100,
  backgroundColor: whiteTransparent.subtle,
  color: neutral.gray4,
  '& svg': { fontSize: '21.6px' },
  '&:hover': { backgroundColor: whiteTransparent.soft },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const Content = styled('div')(({ theme }) => ({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(6.25),
  width: 500,
  maxWidth: '100%',
  margin: '0 auto',
  '& .MuiButton-root:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const Frame = styled('div')(({ theme }) => ({
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 24,
  padding: theme.spacing(12.5),
  '@media (max-height: 900px)': {
    padding: theme.spacing(7.5),
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    zIndex: 0,
    left: '50%',
    top: 'calc(50% + 179.5px)',
    width: 1037,
    height: 513,
    borderRadius: '50%',
    background: rarity.mythic,
    opacity: 0.3,
    filter: 'blur(250px)',
    transform: 'translateX(-50%)',
    pointerEvents: 'none',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    zIndex: 2,
    inset: 0,
    border: `1px solid ${whiteTransparent.subtle}`,
    borderRadius: 'inherit',
    pointerEvents: 'none',
  },
}));

const Group = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
}));

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiBackdrop-root': {
    backgroundColor: blackTransparent.backdrop,
  },
  '& .MuiDialog-paper': {
    width: 700,
    maxWidth: 'calc(100vw - 32px)',
    margin: theme.spacing(2),
    borderRadius: 24,
    backgroundColor: 'var(--modal-surface)',
    backgroundImage: 'none',
    boxShadow: 'none',
  },
}));

const Title = styled('h2')(({ theme }) => ({
  margin: 0,
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(24),
  fontWeight: 600,
  lineHeight: 'normal',
}));

export { Actions, Body, CloseButton, Content, Frame, Group, StyledDialog, Title };
