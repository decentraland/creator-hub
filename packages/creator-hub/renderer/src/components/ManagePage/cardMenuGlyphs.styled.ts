import { styled } from 'decentraland-ui2';

import { CalendarIcon, JumpInIcon, LinkIcon, StorageIcon, SwapIcon, UnpublishIcon } from '../Icons';

const CalendarGlyph = styled(CalendarIcon)(({ theme }) => ({
  '&&&': { fontSize: theme.typography.pxToRem(16) },
}));

const JumpInGlyph = styled(JumpInIcon)(({ theme }) => ({
  '&&&': { fontSize: theme.typography.pxToRem(24), color: theme.palette.primary.main },
}));

const LinkGlyph = styled(LinkIcon)(({ theme }) => ({
  '&&&': { fontSize: theme.typography.pxToRem(16) },
}));

const StorageGlyph = styled(StorageIcon)(({ theme }) => ({
  '&&&': { fontSize: theme.typography.pxToRem(16) },
}));

const SwapGlyph = styled(SwapIcon)(({ theme }) => ({
  '&&&': { fontSize: theme.typography.pxToRem(16) },
}));

const UnpublishGlyph = styled(UnpublishIcon)(({ theme }) => ({
  '&&&': { fontSize: theme.typography.pxToRem(20) },
}));

export { CalendarGlyph, JumpInGlyph, LinkGlyph, StorageGlyph, SwapGlyph, UnpublishGlyph };
