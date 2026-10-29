import { dclColors, IconButton, styled } from 'decentraland-ui2';

const { blackTransparent, neutral, whiteTransparent } = dclColors;

const Actions = styled('div')(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(3.75),
  '& > button': { width: 185 },
}));

const ErrorBlock = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  color: theme.palette.error.main,
  fontSize: theme.typography.pxToRem(12),
  lineHeight: 'normal',
  '& ul': { margin: 0, paddingLeft: theme.spacing(2.25) },
}));

const EyeButton = styled(IconButton)(({ theme }) => ({
  width: 40,
  height: 40,
  marginRight: theme.spacing(-1.25),
  color: neutral.gray4,
  '& svg': { width: 20, height: 20, borderRadius: 4 },
  '&:hover': { backgroundColor: 'transparent' },
  '&:hover svg': { backgroundColor: whiteTransparent.subtle },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: -2,
  },
}));

const Field = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.25),
  width: 400,
}));

const FieldLabel = styled('label')(({ theme }) => ({
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 600,
  lineHeight: 'normal',
}));

const Footer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
  width: 400,
}));

const Info = styled('p')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.25),
  margin: 0,
  padding: theme.spacing(1.25),
  borderRadius: 10,
  backgroundColor: blackTransparent.blurry,
  color: neutral.gray3,
  fontSize: theme.typography.pxToRem(12),
  lineHeight: 'normal',
  '& svg': { width: 14, height: 14, flexShrink: 0 },
}));

const Mismatch = styled('span')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.25),
  '& svg': { width: 12, height: 12, flexShrink: 0 },
}));

export { Actions, ErrorBlock, EyeButton, Field, FieldLabel, Footer, Info, Mismatch };
