import { styled } from 'decentraland-ui2';

import { JumpInIcon } from '../../Icons';

const Grid = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, 416px)',
  gap: theme.spacing(2.5),
}));

const JumpInGlyph = styled(JumpInIcon)(({ theme }) => ({
  '&&&': { color: theme.palette.primary.main },
}));

export { Grid, JumpInGlyph };
