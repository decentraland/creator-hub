import { Button, Skeleton, styled } from 'decentraland-ui2';

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

const FilterNote = styled('span')({
  ...typeToken('h6-regular'),
  color: 'var(--gray)',
  marginRight: 20,
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

const Chip = styled('span')({
  ...typeToken('h8-semi'),
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  gap: 4,
  padding: '4px 8px 4px 6px',
  borderRadius: 'var(--r-pill)',
  border: '1px solid',
  textTransform: 'uppercase',
  '&[data-status="in_program"]': {
    color: 'var(--palette-rarity-rare)',
    borderColor: 'var(--palette-rarity-rare)',
    backgroundColor: 'var(--success-bg)',
  },
  '&[data-status="not_eligible"]': {
    color: 'var(--error)',
    borderColor: 'var(--error)',
    backgroundColor: 'var(--error-bg)',
    cursor: 'default',
  },
  '&[data-status="replaced"]': {
    color: 'var(--dcl-silver)',
    borderColor: 'var(--dcl-silver)',
    backgroundColor: 'var(--palette-whiteTransparent-faint)',
    cursor: 'default',
  },
  ...focusRing,
});

const TooltipLine = styled('span')({
  display: 'block',
});

const Metric = styled('div')({
  flex: '0 1 220px',
  minWidth: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  margin: 0,
});

const MetricLabel = styled('dt')({
  ...typeToken('h7-semi'),
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  height: 28,
  minWidth: 'max-content',
  color: 'var(--dcl-silver)',
  whiteSpace: 'nowrap',
  '& svg': { flexShrink: 0 },
});

const MetricLabelText = styled('span')({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const MetricSkeleton = styled(Skeleton)({
  width: 72,
});

const MetricValue = styled('dd')({
  ...typeToken('h4-semi'),
  fontVariantNumeric: 'tabular-nums',
  margin: 0,
  color: 'var(--palette-neutral-softWhite)',
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

const InfoButton = styled('button')({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  width: 24,
  height: 24,
  padding: 0,
  border: 0,
  borderRadius: 'var(--r-pill)',
  backgroundColor: 'transparent',
  color: 'var(--dcl-silver)',
  cursor: 'pointer',
  '& svg': { width: 14.4, height: 14.4 },
  '&[aria-describedby]': { backgroundColor: 'var(--palette-whiteTransparent-subtle)' },
  ...focusRing,
});

const MetricInfoButton = styled(InfoButton)({
  color: 'var(--dropdown)',
  '&:hover': { backgroundColor: 'var(--palette-whiteTransparent-subtle)' },
});

const ErrorLine = styled('p')({
  ...typeToken('h6-regular'),
  maxWidth: 550,
  margin: 0,
  color: 'var(--dcl-silver)',
  textAlign: 'center',
});

export {
  Chip,
  CycleSelectBox,
  ErrorLine,
  FilterBar,
  FilterGroup,
  FilterLabel,
  FilterNote,
  FilterSentence,
  InfoButton,
  JumpIn,
  Metric,
  MetricInfoButton,
  MetricLabel,
  MetricLabelText,
  MetricSkeleton,
  MetricValue,
  PageBackdrop,
  StateBox,
  TooltipLine,
};
