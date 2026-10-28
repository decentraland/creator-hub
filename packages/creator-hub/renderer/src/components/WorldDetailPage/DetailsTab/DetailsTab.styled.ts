import { alpha, dclColors, IconButton, styled } from 'decentraland-ui2';

const { blackTransparent, neutral } = dclColors;

const CheckSlot = styled('span')({
  display: 'inline-flex',
  flex: '0 0 16px',
  width: 16,
  height: 16,
  '& svg': { width: 16, height: 16 },
});

const Columns = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(6.25),
  paddingTop: theme.spacing(1.125),
}));

const EditButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1.25),
  right: theme.spacing(1.25),
  width: 46,
  height: 46,
  borderRadius: 12,
  backgroundColor: blackTransparent.backdrop,
  color: neutral.softWhite,
  '& svg': { width: 20, height: 20 },
  '&:hover': { backgroundColor: blackTransparent.backdrop },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const Form = styled('div')(({ theme }) => ({
  display: 'flex',
  flex: '1 1 0',
  flexDirection: 'column',
  gap: theme.spacing(5),
  minWidth: 0,
  maxWidth: 1044,
}));

const NoImage = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  backgroundColor: alpha(neutral.white, 0.05),
  color: neutral.gray3,
  fontSize: theme.typography.pxToRem(16),
}));

const ThumbnailBox = styled('div')({
  position: 'relative',
  width: '100%',
  height: 354,
  borderRadius: 16,
  overflow: 'hidden',
  '& img': {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
});

const ThumbnailColumn = styled('div')(({ theme }) => ({
  display: 'flex',
  flex: '0 0 630px',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
}));

const ThumbnailHint = styled('p')(({ theme }) => ({
  margin: 0,
  color: alpha(neutral.white, 0.7),
  fontSize: theme.typography.pxToRem(16),
  lineHeight: 'normal',
}));

const ThumbnailTitle = styled('h3')(({ theme }) => ({
  margin: 0,
  color: neutral.white,
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 600,
  lineHeight: 'normal',
}));

export {
  CheckSlot,
  Columns,
  EditButton,
  Form,
  NoImage,
  ThumbnailBox,
  ThumbnailColumn,
  ThumbnailHint,
  ThumbnailTitle,
};
