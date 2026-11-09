import { Chip, IconButton, Menu, styled } from 'decentraland-ui2';

import { focusRing, typeToken } from '../tokens';

const Header = styled('header')({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  minHeight: 75,
});

const TitleColumn = styled('div')({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
});

const TitleRow = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
});

const Title = styled('h1')({
  ...typeToken('display-semi'),
  margin: 0,
  color: 'var(--palette-neutral-softWhite)',
});

const TitleDot = styled('span')({
  fontWeight: 400,
});

const Beta = styled(Chip)({
  '&&&': {
    height: 'auto',
    padding: '4px 10px',
    borderRadius: 'var(--r-pill)',
    backgroundColor: 'var(--palette-whiteTransparent-subtle)',
  },
  '& .MuiChip-label': {
    ...typeToken('h7-semi-caps'),
    padding: 0,
    color: 'var(--palette-neutral-softWhite)',
    textTransform: 'uppercase',
  },
});

const JoinedLine = styled('span')({
  ...typeToken('h7-regular'),
  color: 'var(--dcl-silver)',
});

const Kebab = styled(IconButton)({
  width: 40,
  height: 40,
  borderRadius: 'var(--r-pill)',
  color: 'var(--palette-neutral-softWhite)',
  '&:hover, &[aria-expanded="true"]': {
    backgroundColor: 'var(--palette-whiteTransparent-subtle)',
  },
  ...focusRing,
});

const KebabMenu = styled(Menu)({
  '& .MuiPaper-root': {
    width: 200,
    marginTop: 9,
    backgroundColor: 'var(--menu-bg)',
    backgroundImage: 'none',
    border: '1px solid var(--palette-whiteTransparent-subtle)',
    borderRadius: 'var(--shape-borderRadiusLarge)',
    boxShadow: 'var(--menu-shadow)',
  },
  '& .MuiList-root': { padding: '10px 0' },
  '& .MuiMenuItem-root': {
    ...typeToken('h7-regular'),
    height: 38,
    minHeight: 38,
    margin: '0 10px',
    padding: '0 10px',
    gap: 10,
    borderRadius: 'var(--shape-borderRadiusMedium)',
    color: 'var(--palette-neutral-softWhite)',
    '& svg': { flexShrink: 0, width: 18, height: 18, color: 'var(--dcl-silver)' },
    '&:hover, &.Mui-focusVisible': { backgroundColor: 'var(--dark-gray)' },
    '&.Mui-focusVisible': { boxShadow: 'inset 0 0 0 1px var(--palette-neutral-softWhite)' },
  },
});

export { Beta, Header, JoinedLine, Kebab, KebabMenu, Title, TitleColumn, TitleDot, TitleRow };
