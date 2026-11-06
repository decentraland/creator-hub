import { Button, CircularProgress, IconButton, Modal as MuiModal, styled } from 'decentraland-ui2';

import { Modal } from '../Modals';

import { focusRing, typeToken } from './tokens';

const paper = {
  position: 'relative' as const,
  boxSizing: 'border-box' as const,
  backgroundColor: 'var(--modal)',
  backgroundImage: 'none',
  border: '1px solid var(--palette-whiteTransparent-subtle)',
  borderRadius: 'var(--shape-borderRadiusXXLarge)',
  padding: 0,
};

const scrim = { '& > .MuiBackdrop-root': { backgroundColor: 'var(--black-80)' } };

const StatusModal = styled(Modal)({
  ...scrim,
  '& > .MuiPaper-root': {
    ...paper,
    width: 700,
    maxHeight: '90vh',
    overflowX: 'hidden',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  },
  '&&& > .MuiPaper-root > .MuiBox-root': { padding: 0 },
});

const WelcomeRoot = styled(MuiModal)({
  ...scrim,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const WelcomeFrame = styled('div')({
  position: 'relative',
  outline: 'none',
});

const WelcomePaper = styled('div')({
  ...paper,
  zIndex: 1,
  width: 700,
  maxHeight: '90vh',
  overflow: 'auto',
  overscrollBehavior: 'contain',
});

const ModalCta = styled(Button)({
  '&&&&&&&': {
    ...typeToken('h6-semi'),
    lineHeight: '22px',
    textTransform: 'uppercase',
    minHeight: 46,
    padding: '12px 24px',
    borderRadius: 'var(--shape-borderRadiusLarge)',
    color: 'var(--palette-neutral-softWhite)',
    boxShadow: 'none',
    ...focusRing,
  },
  '&&&&&&& .MuiTouchRipple-root': { display: 'none' },
  '&&&&&&&.MuiButton-containedPrimary': { background: 'var(--primary)' },
  '&&&&&&&.MuiButton-containedPrimary:hover': { background: 'var(--primary-hover)' },
  '&&&&&&&.MuiButton-containedSecondary': {
    background: 'var(--palette-whiteTransparent-subtle)',
  },
  '&&&&&&&.MuiButton-containedSecondary:hover': {
    background: 'var(--palette-whiteTransparent-soft)',
  },
  '&&&&&&&.Mui-disabled': {
    background: 'var(--primary)',
    color: 'var(--palette-neutral-softWhite)',
    opacity: 0.2,
  },
});

const SpinnerBox = styled('span')({
  display: 'inline-flex',
});

const CheckingSpinnerBox = styled('span')({
  display: 'inline-grid',
  placeItems: 'center',
  width: 80,
  height: 80,
  '& > *': { gridArea: '1 / 1' },
});

const SpinnerTrack = styled(CircularProgress)({
  color: 'var(--palette-neutral-softWhite)',
  opacity: 0.3,
});

const SpinnerArc = styled(CircularProgress)({
  color: 'var(--primary)',
  '& .MuiCircularProgress-circle': { strokeLinecap: 'round' },
});

const TermsShell = styled(Modal)({
  ...scrim,
  '& > .MuiPaper-root': {
    ...paper,
    width: 800,
    height: 700,
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  '&&& > .MuiPaper-root > .MuiBox-root': {
    padding: 0,
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
});

const StatusDialog = styled('div')({
  position: 'relative',
  padding: 99,
  display: 'flex',
  justifyContent: 'center',
  outline: 'none',
});

const GlowLayer = styled('div')({
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  borderRadius: 'inherit',
  pointerEvents: 'none',
});

const StatusGlow = styled('div')({
  position: 'absolute',
  width: 1037,
  height: 513,
  left: '50%',
  top: 'calc(50% + 437px)',
  transform: 'translate(-50%, -50%) scaleY(-1)',
  borderRadius: '50%',
  backgroundColor: 'var(--palette-rarity-mythic)',
  opacity: 0.3,
  filter: 'blur(250px)',
});

const StatusBody = styled('div')({
  position: 'relative',
  zIndex: 1,
  width: 500,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
});

const ModalTitle = styled('h2')({
  ...typeToken('h2-semi'),
  margin: 0,
  color: 'var(--palette-neutral-softWhite)',
});

const ModalText = styled('p')({
  ...typeToken('h6-regular'),
  margin: 0,
  color: 'var(--gray)',
});

const CloseButton = styled(IconButton)({
  position: 'absolute',
  top: 19,
  right: 19,
  zIndex: 2,
  width: 36,
  height: 36,
  borderRadius: 'var(--r-pill)',
  backgroundColor: 'var(--palette-whiteTransparent-subtle)',
  color: 'var(--gray)',
  '& svg': { width: 21.6, height: 21.6 },
  '&:hover': { backgroundColor: 'var(--palette-whiteTransparent-soft)' },
  ...focusRing,
});

const ErrorLine = styled('p')({
  ...typeToken('h7-regular'),
  margin: 0,
  color: 'var(--error)',
  textAlign: 'center',
});

const Actions = styled('div')({
  display: 'flex',
  gap: 20,
  width: '100%',
  '& > *': { flex: 1 },
  '&& .MuiButton-root + .MuiButton-root': { marginLeft: 0 },
});

const VisuallyHidden = styled('span')({
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
});

export {
  Actions,
  CheckingSpinnerBox,
  CloseButton,
  ErrorLine,
  GlowLayer,
  ModalCta,
  ModalText,
  ModalTitle,
  SpinnerArc,
  SpinnerBox,
  SpinnerTrack,
  StatusBody,
  StatusDialog,
  StatusGlow,
  StatusModal,
  TermsShell,
  VisuallyHidden,
  WelcomeFrame,
  WelcomePaper,
  WelcomeRoot,
};
