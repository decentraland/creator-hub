import { dclColors, OutlinedInput, styled, type Theme } from 'decentraland-ui2';

const { neutral, whiteTransparent } = dclColors;

type Metrics = { height: number; inline: string; multiline: string };

const inputStyles = (theme: Theme, { height, inline, multiline }: Metrics) => ({
  '&&': {
    padding: inline,
    gap: theme.spacing(1),
    borderRadius: 12,
    color: neutral.softWhite,
    fontSize: theme.typography.pxToRem(16),
  },
  '&:not(.MuiInputBase-multiline)': {
    height,
  },
  '&&.MuiInputBase-multiline': {
    alignItems: 'flex-start',
    padding: multiline,
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: `1px solid ${whiteTransparent.blurry}`,
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: whiteTransparent.backdrop,
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    border: `1.5px solid ${neutral.softWhite}`,
  },
  '&.Mui-error .MuiOutlinedInput-notchedOutline': {
    border: `1.5px solid ${theme.palette.error.main}`,
  },
  '& input, & textarea': {
    padding: 0,
  },
  '& input::placeholder': {
    color: whiteTransparent.blurry,
    opacity: 1,
  },
});

const FormTextInput = styled(OutlinedInput)(({ theme }) =>
  inputStyles(theme, {
    height: 46,
    inline: theme.spacing(0, 2),
    multiline: theme.spacing(1.75, 2),
  }),
);

const TextInput = styled(OutlinedInput)(({ theme }) =>
  inputStyles(theme, {
    height: 40,
    inline: theme.spacing(0, 1, 0, 2),
    multiline: theme.spacing(1.3125, 2),
  }),
);

export { FormTextInput, TextInput };
