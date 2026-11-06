import { styled, TextField } from 'decentraland-ui2';

import { typeToken } from './tokens';

const Form = styled('form')({
  position: 'relative',
  zIndex: 1,
  width: 500,
  display: 'flex',
  flexDirection: 'column',
  gap: 25,
});

const Intro = styled('p')({
  ...typeToken('h7-regular'),
  margin: 0,
  color: 'var(--palette-neutral-softWhite)',
});

const Fields = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 25,
});

const NameRow = styled('div')({
  display: 'flex',
  gap: 20,
  '& > *': { flex: 1, minWidth: 0 },
});

const FieldGroup = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

const Label = styled('label')({
  ...typeToken('h6-semi'),
  color: 'var(--palette-neutral-softWhite)',
});

const Required = styled('span')({
  color: 'var(--primary)',
});

const Input = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    height: 46,
    borderRadius: 'var(--shape-borderRadiusLarge)',
    color: 'var(--palette-neutral-softWhite)',
    ...typeToken('h6-regular'),
  },
  '& .MuiOutlinedInput-input': {
    padding: '14px 16px',
    '&::placeholder': { color: 'var(--palette-whiteTransparent-blurry)', opacity: 1 },
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--palette-whiteTransparent-blurry)',
  },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--palette-whiteTransparent-backdrop)',
  },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--palette-neutral-softWhite)',
    borderWidth: 1.5,
  },
  '& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline': {
    borderColor: 'var(--error)',
    borderWidth: 1.5,
  },
});

const FieldError = styled('span')({
  ...typeToken('h7-regular'),
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  height: 15,
  color: 'var(--error)',
});

export { FieldError, FieldGroup, Fields, Form, Input, Intro, Label, NameRow, Required };
