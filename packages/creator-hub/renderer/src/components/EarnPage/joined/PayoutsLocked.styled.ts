import { styled } from 'decentraland-ui2';

import { typeToken } from '../tokens';

import { EmptyPanel } from './PayoutsTab.styled';

const Illustration = styled('img')({
  display: 'block',
  width: 80,
  height: 80,
});

const Title = styled('h2')({
  ...typeToken('h2-semi'),
  maxWidth: 524,
  margin: 0,
  color: 'var(--palette-neutral-softWhite)',
});

const LockedPanel = styled(EmptyPanel)({
  alignItems: 'center',
  justifyContent: 'center',
  gap: 30,
  textAlign: 'center',
});

export { Illustration, LockedPanel, Title };
