import { alpha, dclColors, styled } from 'decentraland-ui2';

import texture from '/assets/images/place-entry-texture.png';

const { blackTransparent, neutral, whiteTransparent } = dclColors;

const Card = styled('article')(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  width: 416,
  height: 383,
  borderRadius: 16,
  border: `1px solid ${whiteTransparent.subtle}`,
  overflow: 'hidden',
  backgroundColor: alpha(neutral.white, 0.05),
  '&:hover, &:focus-within, &:has([aria-expanded="true"])': {
    backgroundColor: whiteTransparent.subtle,
  },
  '&:has(a:focus-visible)': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const EmptyThumbnail = styled('div')(({ theme }) => ({
  position: 'relative',
  isolation: 'isolate',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(1.625),
  paddingTop: theme.spacing(11.75),
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(18),
  lineHeight: 1,
  '& .MuiButton-root': {
    position: 'relative',
    zIndex: 1,
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    zIndex: -1,
    backgroundImage: `url(${texture})`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    opacity: 0.03,
    mixBlendMode: 'luminosity',
  },
}));

const Kebab = styled('div')(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(2.25),
  right: theme.spacing(1.25),
  zIndex: 1,
}));

const Name = styled('h2')(({ theme }) => ({
  margin: 0,
  paddingRight: theme.spacing(5),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(20),
  fontWeight: 600,
  lineHeight: 1,
  '& a': {
    color: 'inherit',
    textDecoration: 'none',
    outline: 'none',
  },
  '& a::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
  },
}));

const PlaceRow = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  color: neutral.gray3,
  fontSize: theme.typography.pxToRem(16),
  lineHeight: 1.5,
  '& > svg': { fontSize: theme.typography.pxToRem(16) },
  '& > span + span': { marginLeft: theme.spacing(0.5) },
}));

const Stats = styled('span')(({ theme }) => ({
  position: 'absolute',
  left: theme.spacing(1.25),
  bottom: theme.spacing(1.25),
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.625),
  padding: theme.spacing(0.75, 1.25),
  borderRadius: 100,
  backgroundColor: blackTransparent.backdrop,
  color: neutral.gray4,
  fontSize: theme.typography.pxToRem(14),
  lineHeight: 1,
  '& svg': { fontSize: theme.typography.pxToRem(14) },
}));

const TextBlock = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  gap: theme.spacing(1.25),
  height: 110,
  padding: theme.spacing(2.5),
}));

const Thumbnail = styled('div')({
  position: 'relative',
  flex: 1,
  minHeight: 0,
  borderRadius: 16,
  overflow: 'hidden',
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
});

export { Card, EmptyThumbnail, Kebab, Name, PlaceRow, Stats, TextBlock, Thumbnail };
