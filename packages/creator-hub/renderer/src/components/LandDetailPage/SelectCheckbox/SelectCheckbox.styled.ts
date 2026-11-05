import { Checkbox, dclColors, styled } from 'decentraland-ui2';

const { whiteTransparent } = dclColors;

const Box = styled(Checkbox)(({ theme }) => ({
  '&&': { padding: 0 },
  '& svg': { fontSize: '26.67px', margin: '-3.33px' },
  '&.Mui-focusVisible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
    borderRadius: 5,
  },
}));

const OffBox = styled('span')({
  display: 'block',
  boxSizing: 'border-box',
  width: 20,
  height: 20,
  borderRadius: 5,
  border: `1px solid ${whiteTransparent.blurry}`,
});

export { Box, OffBox };
