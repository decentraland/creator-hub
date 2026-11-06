import { styled } from 'decentraland-ui2';

import { focusRing, typeToken } from './tokens';

const Snackbar = styled('div')({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 20,
  boxSizing: 'border-box',
  maxWidth: '100%',
  minHeight: 44,
  padding: '12px 16px 12px 12px',
  borderRadius: 'var(--shape-borderRadiusLarge)',
  '&[data-tone="danger"]': { backgroundColor: 'var(--palette-error-dark2)' },
  '&[data-tone="neutral"]': { backgroundColor: 'var(--darker-gray)' },
});

const Message = styled('p')({
  ...typeToken('h7-regular'),
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: 'var(--palette-neutral-softWhite)',
  '& svg': { flexShrink: 0, width: 20, height: 20 },
});

const Action = styled('button')({
  ...typeToken('h7-semi-caps'),
  textTransform: 'uppercase',
  padding: '3.5px 0',
  margin: '-3.5px 0',
  border: 0,
  background: 'none',
  cursor: 'pointer',
  color: 'var(--palette-neutral-softWhite)',
  '&[data-emphasis="muted"]': { color: 'var(--palette-whiteTransparent-backdrop)' },
  '&[data-emphasis="primary"]': { color: 'var(--primary)' },
  '&:hover': { textDecoration: 'underline' },
  ...focusRing,
  '[data-tone="danger"] > &:focus-visible': {
    outlineColor: 'var(--palette-neutral-softWhite)',
  },
});

export { Action, Message, Snackbar };
