import { dclColors, Select, styled } from 'decentraland-ui2';

import { ExternalLink } from '../../ExternalLink';
import { FormTextInput } from '../../TextInput';

const { neutral, whiteTransparent } = dclColors;

const DescriptionInput = styled(FormTextInput)({
  '&&': { minHeight: 168 },
});

const DomainSelect = styled(Select)(({ theme }) => ({
  '&&': {
    width: '100%',
    height: 46,
    borderRadius: 12,
    color: neutral.softWhite,
  },
  '&& .MuiOutlinedInput-notchedOutline': {
    border: `1px solid ${whiteTransparent.blurry}`,
  },
  '&&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: whiteTransparent.backdrop,
  },
  '&&.Mui-disabled': { cursor: 'not-allowed' },
  '&&.Mui-disabled .MuiOutlinedInput-notchedOutline': {
    borderColor: whiteTransparent.soft,
  },
  '&&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    border: `1px solid ${neutral.softWhite}`,
  },
  '&&:has(.MuiSelect-select:focus-visible)': {
    boxShadow: `0 0 0 2px ${theme.palette.info.light}`,
  },
  '&&& .MuiSelect-select': {
    minHeight: 0,
    padding: theme.spacing(1.75, 5, 1.75, 2),
    fontSize: theme.typography.pxToRem(16),
    lineHeight: theme.typography.pxToRem(18),
  },
  '&& .MuiSelect-icon': {
    top: 'calc(50% - 3.5px)',
    right: theme.spacing(2),
    color: neutral.softWhite,
  },
  '&&& .MuiSelect-select.Mui-disabled': {
    color: whiteTransparent.soft,
    WebkitTextFillColor: whiteTransparent.soft,
    cursor: 'not-allowed',
  },
  '&&.Mui-disabled .MuiSelect-icon': { color: whiteTransparent.soft },
}));

const EmptyValue = styled('span')({
  color: neutral.gray3,
});

const ClaimLink = styled(ExternalLink)(({ theme }) => ({
  alignSelf: 'flex-start',
  color: theme.palette.primary.main,
  fontSize: theme.typography.pxToRem(14),
  fontWeight: 600,
  lineHeight: 'normal',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
  textDecorationThickness: '1px',
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.info.light}`,
    outlineOffset: 2,
  },
}));

const InputSlot = styled('div')({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
});

const Help = styled('span')(({ theme }) => ({
  position: 'absolute',
  top: `calc(100% + ${theme.spacing(0.5)})`,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  lineHeight: 'normal',
}));

const Counter = styled('span')<{ over: 'over' | 'within' }>(({ theme, over }) => ({
  marginLeft: 'auto',
  color: over === 'over' ? theme.palette.error.main : neutral.gray3,
  fontSize: theme.typography.pxToRem(12),
}));

const ErrorText = styled('span')(({ theme }) => ({
  color: theme.palette.error.main,
  fontSize: theme.typography.pxToRem(14),
  lineHeight: 'normal',
}));

const Field = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.25),
  width: '100%',
  maxWidth: 1044,
}));

const FieldTitle = styled('label')(({ theme }) => ({
  color: neutral.white,
  fontSize: theme.typography.pxToRem(18),
  fontWeight: 600,
  lineHeight: 'normal',
}));

const DomainHelp = styled('p')(({ theme }) => ({
  margin: 0,
  color: neutral.softWhite,
  fontSize: theme.typography.pxToRem(14),
  lineHeight: 'normal',
}));

const ReadOnly = styled('dl')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  margin: 0,
  '& dt': {
    color: neutral.white,
    fontSize: theme.typography.pxToRem(16),
    fontWeight: 600,
  },
  '& dd': {
    margin: theme.spacing(0, 0, 2),
    color: neutral.softWhite,
    fontSize: theme.typography.pxToRem(16),
  },
}));

const Root = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(5),
  paddingTop: theme.spacing(1.125),
}));

const SetName = styled(FormTextInput)(({ theme }) => ({
  '&&': { gap: theme.spacing(1.25) },
  '& .MuiIconButton-root': {
    padding: theme.spacing(0.625),
    margin: theme.spacing(-0.625),
    color: neutral.white,
  },
}));

export {
  ClaimLink,
  Counter,
  DescriptionInput,
  DomainHelp,
  DomainSelect,
  EmptyValue,
  ErrorText,
  Field,
  FieldTitle,
  Help,
  InputSlot,
  ReadOnly,
  Root,
  SetName,
};
