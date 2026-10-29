import { dclColors, styled } from 'decentraland-ui2';

const { neutral } = dclColors;

const MultiScene = styled('span')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(14),
  whiteSpace: 'nowrap',
}));

const StorageLink = styled('button')(({ theme }) => ({
  padding: 0,
  border: 0,
  background: 'none',
  cursor: 'pointer',
  color: theme.palette.primary.main,
  fontFamily: 'inherit',
  fontSize: theme.typography.pxToRem(14),
  fontWeight: 600,
  lineHeight: 'normal',
  whiteSpace: 'nowrap',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
  textDecorationThickness: '1px',
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

export { MultiScene, StorageLink };
