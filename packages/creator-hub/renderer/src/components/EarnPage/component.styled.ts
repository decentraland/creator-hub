import { styled } from 'decentraland-ui2';

import { PageBackdrop } from './joined/parts.styled';

const StickyNavbar = styled(PageBackdrop)({
  position: 'sticky',
  top: 0,
  zIndex: 3,
  paddingBottom: 30,
  '& > .Header.Navbar': { marginBottom: 0 },
});

export { StickyNavbar };
