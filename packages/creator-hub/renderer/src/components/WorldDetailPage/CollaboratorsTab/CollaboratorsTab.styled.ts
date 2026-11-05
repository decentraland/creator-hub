import { dclColors, styled } from 'decentraland-ui2';

import { Description, ListBlock } from '../../LandDetailPage/access/access.styled';

const { neutral } = dclColors;

const StreamNote = styled('p')(({ theme }) => ({
  margin: 0,
  color: neutral.gray4,
  fontSize: theme.typography.pxToRem(14),
  fontWeight: 400,
}));

const WorldDescription = styled(Description)({ whiteSpace: 'nowrap' });

const WorldListBlock = styled(ListBlock)({
  '& > div, & li': { gridTemplateColumns: '524px 200px 80px minmax(0, 1fr) 30px' },
  '& li > .Note': { gridColumn: 3, justifySelf: 'center' },
  '& > div > .StreamHeader': { justifySelf: 'center' },
  '& li > .Trash': { gridColumn: 5 },
});

export { StreamNote, WorldDescription, WorldListBlock };
