import { dclColors, styled } from 'decentraland-ui2';

const { brand, neutral, whiteTransparent } = dclColors;

const DetailsButton = styled('button')(({ theme }) => ({
  marginTop: theme.spacing(1),
  padding: 0,
  border: 'none',
  backgroundColor: 'transparent',
  color: neutral.softWhite,
  fontFamily: 'inherit',
  fontSize: 'inherit',
  fontWeight: 600,
  textDecoration: 'underline',
  cursor: 'pointer',
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const Fill = styled('span')({
  display: 'block',
  height: 12,
  borderRadius: 100,
  background: `linear-gradient(90deg, ${brand.ruby}, ${brand.yellow})`,
});

const Label = styled('span')(({ theme }) => ({
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(18),
  lineHeight: theme.typography.pxToRem(22),
}));

const LabelRow = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  height: 22,
}));

const Root = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.25),
}));

const Track = styled('div')({
  boxSizing: 'border-box',
  width: 501,
  maxWidth: '100%',
  height: 16,
  padding: 2,
  borderRadius: 100,
  backgroundColor: whiteTransparent.subtle,
});

const Value = styled('span')(({ theme }) => ({
  color: neutral.gray3,
  fontSize: theme.typography.pxToRem(16),
  lineHeight: 1,
  '& b': {
    color: neutral.softWhite,
    fontSize: theme.typography.pxToRem(20),
    fontWeight: 600,
  },
}));

const ValueRow = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2.5),
  height: 24,
}));

export { DetailsButton, Fill, Label, LabelRow, Root, Track, Value, ValueRow };
