import { styled } from 'decentraland-ui2';

const MenuCorner = styled('div')({
  position: 'relative',
  zIndex: 2,
  height: 0,
  '& > .MuiIconButton-root': {
    position: 'absolute',
    top: 17.5,
    right: 'clamp(16px, 5.104vw, 98px)',
  },
});

export { MenuCorner };
