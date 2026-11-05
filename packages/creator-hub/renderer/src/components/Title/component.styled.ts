import { dclColors, IconButton, styled, Typography } from 'decentraland-ui2';

const { neutral, whiteTransparent } = dclColors;

const BackButton = styled(IconButton)(({ theme }) => ({
  flexShrink: 0,
  width: 40,
  height: 40,
  color: theme.palette.primary.main,
  '& svg': { fontSize: theme.typography.pxToRem(28) },
  '&:hover': { backgroundColor: whiteTransparent.subtle },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const Heading = styled(Typography)(({ theme }) => ({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: neutral.softWhite,
  lineHeight: theme.typography.pxToRem(56),
})) as typeof Typography;

const Root = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  minWidth: 0,
}));

export { BackButton, Heading, Root };
