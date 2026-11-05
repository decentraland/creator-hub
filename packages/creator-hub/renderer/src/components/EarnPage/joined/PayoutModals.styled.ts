import { styled } from 'decentraland-ui2';

import { FieldError as ReservedFieldError, Input } from '../ContactInfoForm.styled';
import { Actions } from '../EarnModal.styled';
import { focusRing, fontFace, typeToken } from '../tokens';

const ModalForm = styled('form')({
  position: 'relative',
  zIndex: 1,
  width: 500,
  display: 'flex',
  flexDirection: 'column',
  gap: 25,
  '&[data-variant="verify"]': { gap: 50 },
});

const ModalIntro = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 25,
});

const Body = styled('p')({
  ...typeToken('h6-regular'),
  margin: 0,
  color: 'var(--gray)',
  overflowWrap: 'anywhere',
  '& b': { fontWeight: 'var(--fw-bold)' },
});

const Field = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

const FieldLabel = styled('label')({
  ...typeToken('h6-semi'),
  color: 'var(--white)',
});

const FieldInput = styled(Input)({
  '&[data-filled="true"] .MuiOutlinedInput-root:not(.Mui-focused):not(.Mui-error) .MuiOutlinedInput-notchedOutline':
    { borderWidth: 2, borderColor: 'var(--palette-whiteTransparent-backdrop)' },
});

const FieldError = styled(ReservedFieldError)({
  '& svg': { flexShrink: 0, width: 12, height: 12 },
});

const Callout = styled('div')({
  ...typeToken('h7-regular'),
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  padding: '12px 14px',
  borderRadius: 'var(--shape-borderRadiusLarge)',
  backgroundColor: 'var(--palette-whiteTransparent-faint)',
  color: 'var(--palette-neutral-softWhite)',
  '& svg': { flexShrink: 0 },
});

const FailureLine = styled('p')({
  ...typeToken('h7-regular'),
  margin: 0,
  color: 'var(--error)',
});

const PayoutActions = styled(Actions)({
  gap: 30,
});

const CodeArea = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 16,
});

const CodeRow = styled('div')({
  display: 'flex',
  gap: 12,
});

const CodeBox = styled('input')({
  ...fontFace,
  boxSizing: 'border-box',
  width: 52,
  height: 60,
  padding: 0,
  borderRadius: 'var(--shape-borderRadiusLarge)',
  border: '2px solid var(--palette-whiteTransparent-blurry)',
  backgroundColor: 'transparent',
  color: 'var(--palette-neutral-softWhite)',
  fontSize: 28,
  fontWeight: 'var(--type-h2-semi-weight)',
  lineHeight: 'normal',
  textAlign: 'center',
  caretColor: 'var(--palette-neutral-softWhite)',
  outline: 'none',
  '&:hover, &[data-filled="true"]': { borderColor: 'var(--palette-whiteTransparent-backdrop)' },
  '&&[aria-invalid="true"]': { borderColor: 'var(--error)' },
  '&&&:focus': { borderColor: 'var(--palette-neutral-softWhite)' },
});

const ResendButton = styled('button')({
  ...typeToken('h7-regular'),
  padding: 0,
  border: 0,
  borderRadius: 'var(--shape-borderRadiusMedium)',
  backgroundColor: 'transparent',
  color: 'var(--gray)',
  cursor: 'pointer',
  '&:not([aria-disabled="true"]):hover, &:focus-visible': { textDecoration: 'underline' },
  '&[aria-disabled="true"]': { cursor: 'default' },
  ...focusRing,
});

const CodeError = styled('p')({
  ...typeToken('h7-regular'),
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  margin: 0,
  color: 'var(--error)',
  '--cf-close-stroke': 'var(--error)',
  '& svg': { flexShrink: 0, width: 16, height: 16 },
});

export {
  Body,
  Callout,
  CodeArea,
  CodeBox,
  CodeError,
  CodeRow,
  FailureLine,
  Field,
  FieldError,
  FieldInput,
  FieldLabel,
  ModalForm,
  ModalIntro,
  PayoutActions,
  ResendButton,
};
