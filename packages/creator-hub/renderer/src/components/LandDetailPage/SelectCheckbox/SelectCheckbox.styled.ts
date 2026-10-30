import { Checkbox, dclColors, styled } from 'decentraland-ui2';

const { neutral, whiteTransparent } = dclColors;

const Box = styled(Checkbox)(({ theme }) => ({
  '&&': { padding: 0 },
  '& svg': { fontSize: '26.67px', margin: '-3.33px' },
  '&.Mui-focusVisible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
    borderRadius: 5,
  },
}));

const Dash = styled('span')(({ theme }) => ({
  width: 10,
  height: 2,
  borderRadius: 1,
  backgroundColor: theme.palette.primary.main,
}));

const FixedOnBox = styled('span')({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  width: 20,
  height: 20,
  borderRadius: 5,
  border: `1px solid ${neutral.gray1}`,
  backgroundColor: neutral.gray1,
  color: neutral.softBlack1,
  '&& svg': { fontSize: 16, margin: 0 },
});

const MixedBox = styled('span')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  width: 20,
  height: 20,
  borderRadius: 5,
  border: `1px solid ${theme.palette.primary.main}`,
  backgroundColor: theme.palette.primary.main,
}));

const MixedDash = styled('span')({
  width: 10,
  height: 2,
  borderRadius: 1,
  backgroundColor: neutral.softBlack1,
});

const OffBox = styled('span')({
  display: 'block',
  boxSizing: 'border-box',
  width: 20,
  height: 20,
  borderRadius: 5,
  border: `1px solid ${whiteTransparent.blurry}`,
});

const OnBox = styled('span')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  width: 20,
  height: 20,
  borderRadius: 5,
  border: `1px solid ${theme.palette.primary.main}`,
  color: theme.palette.primary.main,
  '&& svg': { fontSize: 16, margin: 0 },
}));

export { Box, Dash, FixedOnBox, MixedBox, MixedDash, OffBox, OnBox };
