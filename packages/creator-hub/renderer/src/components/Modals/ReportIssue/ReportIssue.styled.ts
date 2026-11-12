import { dclColors, styled } from 'decentraland-ui2';

import { FieldError } from '../../EarnPage/ContactInfoForm.styled';
import { typeToken } from '../../EarnPage/tokens';
import { ExternalLink } from '../../ExternalLink';
import { FieldTitle, primaryLinkStyles } from '../../LandDetailPage/DetailsTab/DetailsTab.styled';
import { FormTextInput } from '../../TextInput';

const { neutral } = dclColors;

const Form = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
}));

const HelpLink = styled(ExternalLink)(primaryLinkStyles);

const Hint = styled('span')(({ theme }) => ({
  color: neutral.gray3,
  fontSize: theme.typography.pxToRem(14),
  lineHeight: 'normal',
}));

const ContactHint = styled('span')({
  ...typeToken('h7-regular'),
  color: neutral.softWhite,
});

const DescriptionBox = styled(FormTextInput)({
  '&&.MuiInputBase-multiline': { padding: '14px 6px 14px 16px' },
  '&& textarea': {
    boxSizing: 'border-box',
    height: 140,
    minHeight: 140,
    maxHeight: 'max(140px, calc(100vh - 794px))',
    paddingRight: 4,
    overflowY: 'auto',
    resize: 'vertical',
    '@media (max-height: 900px)': { maxHeight: 'max(140px, calc(100vh - 714px))' },
    '&::-webkit-scrollbar': { width: 12 },
    '&::-webkit-scrollbar-track': { background: 'transparent' },
    '&::-webkit-scrollbar-thumb': {
      border: '1px solid transparent',
      backgroundClip: 'padding-box',
      backgroundColor: 'var(--scrollbar-thumb)',
      boxShadow: 'inset 0 0 0 1px var(--scrollbar-thumb-border)',
      borderRadius: 'var(--r-pill)',
    },
    '&::-webkit-scrollbar-corner': { background: 'transparent' },
    '&::-webkit-resizer': {
      background:
        'linear-gradient(to bottom right, transparent 44%, var(--dcl-silver) 44% 56%, transparent 56% 77%, var(--dcl-silver) 77% 89%, transparent 89%) right bottom / 6px 6px no-repeat',
    },
  },
});

const ErrorLine = styled(FieldError)({
  '& svg': { flexShrink: 0, width: 12, height: 12 },
});

const Counter = styled(ErrorLine)({
  ...typeToken('h8-regular'),
  color: neutral.softWhite,
  fontVariantNumeric: 'tabular-nums',
  '&[data-state="over"]': { color: 'var(--error)' },
});

const Label = styled(FieldTitle)(typeToken('h6-semi'));

const LogsOption = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.75),
}));

export { ContactHint, Counter, DescriptionBox, ErrorLine, Form, HelpLink, Hint, Label, LogsOption };
