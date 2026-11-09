import { styled } from 'decentraland-ui2';

import { typeToken } from '../tokens';

import { EmptyPanel } from './PayoutsTab.styled';

const IconBadge = styled('span')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 96,
  height: 96,
  borderRadius: 'var(--r-pill)',
  backgroundColor: 'var(--palette-whiteTransparent-subtle)',
  color: 'var(--palette-neutral-softWhite)',
  '& svg': { width: 48, height: 48 },
});

const Title = styled('h2')({
  ...typeToken('h2-semi'),
  margin: 0,
  color: 'var(--palette-neutral-softWhite)',
});

const LockedPanel = styled(EmptyPanel)({
  alignItems: 'center',
  justifyContent: 'center',
  gap: 24,
  textAlign: 'center',
});

export { IconBadge, LockedPanel, Title };
