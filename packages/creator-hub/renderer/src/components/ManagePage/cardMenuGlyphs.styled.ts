import { styled } from 'decentraland-ui2';

import {
  CalendarIcon,
  JumpInIcon,
  LinkIcon,
  PublicIcon,
  StorageIcon,
  SwapIcon,
  UnpublishIcon,
} from '../Icons';

const CalendarGlyph = styled(CalendarIcon)(({ theme }) => ({
  '&&&': { fontSize: theme.typography.pxToRem(14) },
}));

const JumpInGlyph = styled(JumpInIcon)(({ theme }) => ({
  '&&&': { fontSize: theme.typography.pxToRem(20), color: theme.palette.primary.main },
}));

const LinkGlyph = styled(LinkIcon)(({ theme }) => ({
  '&&&': { fontSize: theme.typography.pxToRem(14) },
}));

const PlaceGlyph = styled(PublicIcon)(({ theme }) => ({
  '&&&': { fontSize: theme.typography.pxToRem(15) },
}));

const StorageGlyph = styled(StorageIcon)(({ theme }) => ({
  '&&&': { fontSize: theme.typography.pxToRem(16) },
}));

const SwapGlyph = styled(SwapIcon)(({ theme }) => ({
  '&&&': { fontSize: theme.typography.pxToRem(14) },
}));

const UnpublishGlyph = styled(UnpublishIcon)(({ theme }) => ({
  '&&&': { fontSize: theme.typography.pxToRem(20) },
}));

export {
  CalendarGlyph,
  JumpInGlyph,
  LinkGlyph,
  PlaceGlyph,
  StorageGlyph,
  SwapGlyph,
  UnpublishGlyph,
};
