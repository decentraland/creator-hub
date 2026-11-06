import { Button, styled } from 'decentraland-ui2';

import background from '/assets/images/background.png';

import { focusRing, typeToken } from '../tokens';

const PageBackdrop = styled('div')({
  background: `var(--page-shade), url(${background}) var(--darker-gray)`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  backgroundBlendMode: 'normal, overlay',
  backgroundAttachment: 'fixed',
});

const FilterBar = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  minHeight: 56,
  padding: '8px 30px',
  boxSizing: 'border-box',
  borderRadius: 'var(--r-pill)',
  backgroundColor: 'var(--palette-whiteTransparent-subtle)',
});

const FilterSentence = styled('p')({
  ...typeToken('h6-regular'),
  flex: 1,
  minWidth: 0,
  margin: 0,
  color: 'var(--gray)',
});

const FilterGroup = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexShrink: 0,
  whiteSpace: 'nowrap',
});

const FilterLabel = styled('span')({
  ...typeToken('h6-regular'),
  color: 'var(--dcl-silver)',
});

const CycleSelectBox = styled('div')({
  '& .MuiInput-root::before, & .MuiInput-root::after': { display: 'none' },
  '& .MuiInputBase-root': {
    padding: 0,
    borderRadius: 'var(--shape-borderRadiusMedium)',
    '&:hover, &.Mui-focused': { backgroundColor: 'var(--palette-whiteTransparent-subtle)' },
  },
  '& .MuiInputBase-root .MuiSelect-select': {
    ...typeToken('h6-regular'),
    minHeight: 0,
    color: 'var(--palette-neutral-softWhite)',
    padding: '10px 28px 10px 10px',
    borderRadius: 'var(--mui-shape-borderRadius)',
  },
  '& .MuiSelect-select:focus-visible': {
    outline: '2px solid var(--palette-info-light)',
    outlineOffset: 2,
  },
  '& .MuiSelect-icon': { top: 'calc(50% - 5px)', right: 10, color: 'var(--dcl-silver)' },
});

const JumpIn = styled(Button)({
  '&&&&&&&': {
    ...typeToken('h7-semi-caps'),
    height: 32,
    minWidth: 0,
    padding: '0 10px',
    gap: 6,
    borderRadius: 'var(--shape-borderRadiusMedium)',
    background: 'var(--primary)',
    color: 'var(--palette-neutral-softWhite)',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    boxShadow: 'none',
    ...focusRing,
  },
  '&&&&&&& .MuiTouchRipple-root': { display: 'none' },
  '&&&&&&&:hover': { background: 'var(--primary-hover)' },
});

const StateBox = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 20,
  padding: 60,
  '&[data-kind="error"]': { paddingTop: 200 },
});

const ErrorLine = styled('p')({
  ...typeToken('h6-regular'),
  maxWidth: 550,
  margin: 0,
  color: 'var(--dcl-silver)',
  textAlign: 'center',
});

export {
  CycleSelectBox,
  ErrorLine,
  FilterBar,
  FilterGroup,
  FilterLabel,
  FilterSentence,
  JumpIn,
  PageBackdrop,
  StateBox,
};
