import { dclColors, styled } from 'decentraland-ui2';

import { TextInput } from '../../TextInput';

const { neutral, whiteTransparent } = dclColors;

const CheckRow = styled('label')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.25),
  alignSelf: 'flex-start',
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(16),
  cursor: 'pointer',
  '& .MuiCheckbox-root': { padding: 0 },
}));

const Note = styled('p')(({ theme }) => ({
  margin: theme.spacing(-0.5, 0, 0, 3.75),
  color: neutral.gray3,
  fontSize: theme.typography.pxToRem(14),
}));

const Root = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(5),
  paddingTop: theme.spacing(1.125),
}));

const Row = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2.5),
  '&.Tight': { gap: theme.spacing(1.25) },
}));

const SectionBlock = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.25),
  '&.Loose': { gap: theme.spacing(2.5) },
}));

const SmallInput = styled(TextInput)(({ theme }) => ({
  '&&': { width: 80 },
  '& .MuiInputAdornment-root, & .Prefix': {
    marginRight: theme.spacing(0.5),
    color: whiteTransparent.blurry,
  },
}));

const Slider = styled('input')(({ theme }) => ({
  width: 300,
  height: 24,
  margin: 0,
  appearance: 'none',
  background: 'transparent',
  cursor: 'pointer',
  '&::-webkit-slider-runnable-track': {
    height: 18,
    borderRadius: 9,
    background: 'var(--gradient-skybox)',
  },
  '&::-webkit-slider-thumb': {
    appearance: 'none',
    width: 24,
    height: 24,
    marginTop: -3,
    borderRadius: '50%',
    backgroundColor: neutral.softWhite,
    border: `0.67px solid ${neutral.gray5}`,
    filter: 'drop-shadow(0 1.35px 1.35px rgb(0 0 0 / 10%))',
  },
  '&:disabled': { opacity: 0.4, cursor: 'default' },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 4,
    borderRadius: 12,
  },
}));

export { CheckRow, Note, Root, Row, SectionBlock, Slider, SmallInput };
