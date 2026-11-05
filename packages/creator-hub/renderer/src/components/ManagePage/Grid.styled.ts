import { styled } from 'decentraland-ui2';

const Grid = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, 416px)',
  gap: theme.spacing(2.5),
}));

export { Grid };
