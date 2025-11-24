import { Backdrop, styled } from 'decentraland-ui2';

const StyledBackdrop = styled(Backdrop)(({ theme }) => ({
  zIndex: theme.zIndex.snackbar - 1,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
}));

export { StyledBackdrop };
