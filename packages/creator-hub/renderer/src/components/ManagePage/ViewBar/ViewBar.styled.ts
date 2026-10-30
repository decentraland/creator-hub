import { dclColors, styled } from 'decentraland-ui2';
import type { Theme } from 'decentraland-ui2';

import { FiltersBar } from '../../FiltersBar';
import { Search } from '../../Search';
import { Select } from '../../Select';

const { neutral, whiteTransparent } = dclColors;

const Bar = styled(FiltersBar)(({ theme }) => ({
  '&&': {
    height: 56,
    margin: 0,
    padding: theme.spacing(0, 1.25),
    gap: theme.spacing(2),
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: whiteTransparent.subtle,
  },
  '&& > .left': {
    flex: '1 0 auto',
    gap: theme.spacing(1.25),
    textTransform: 'none',
  },
  '&& > .right': {
    flex: '0 1 auto',
    minWidth: 0,
    flexWrap: 'nowrap',
    gap: theme.spacing(3.75),
  },
}));

const Field = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.25),
  height: 48,
  flexShrink: 0,
  whiteSpace: 'nowrap',
}));

const FieldLabel = styled('span')(({ theme }) => ({
  color: neutral.gray3,
  fontSize: theme.typography.pxToRem(16),
  fontWeight: 400,
  lineHeight: 1,
}));

const SearchBox = styled(Search)(({ theme }) => ({
  '&&': {
    width: 300,
    flexShrink: 1,
    minWidth: 160,
    height: 39,
    gap: theme.spacing(1.25),
    padding: theme.spacing(1.25, 5, 1.25, 1.25),
    borderRadius: 100,
    border: `1px solid ${whiteTransparent.blurry}`,
    color: neutral.softWhite,
  },
  '&&:hover, &&.Mui-focused, &&:has(input:not(:placeholder-shown))': {
    borderColor: neutral.softWhite,
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '&& input': {
    padding: 0,
    fontSize: theme.typography.pxToRem(16),
    fontWeight: 400,
    color: neutral.softWhite,
  },
  '&& input::-webkit-search-cancel-button': {
    display: 'none',
  },
  '&& input::placeholder': {
    color: whiteTransparent.blurry,
    opacity: 1,
  },
  '&& svg': {
    fontSize: theme.typography.pxToRem(19),
    color: neutral.softWhite,
  },
}));

const ViewSelect = styled(Select)(({ theme }) => ({
  '&&': {
    padding: theme.spacing(1.25),
    borderRadius: 6,
  },
  '&&:hover, &&.Mui-focused': {
    backgroundColor: whiteTransparent.subtle,
  },
  '&&:has(.MuiSelect-select:focus-visible)': {
    boxShadow: `inset 0 0 0 1px ${neutral.softWhite}`,
  },
  '&&& .MuiSelect-select': {
    minHeight: 0,
    padding: theme.spacing(0, 2.5, 0, 0),
    color: neutral.softWhite,
    fontSize: theme.typography.pxToRem(16),
    fontWeight: 400,
    lineHeight: 1,
  },
  '&& .MuiSelect-icon': {
    top: 'calc(50% - 3.5px)',
    right: theme.spacing(1.25),
    color: neutral.softWhite,
  },
}));

const selectRowStyles = ({ theme }: { theme: Theme }) => ({
  '& .MuiMenuItem-root': {
    justifyContent: 'flex-start',
    fontSize: theme.typography.pxToRem(16),
    fontWeight: 400,
    lineHeight: 1.5,
    '& svg': { color: neutral.softWhite },
    '&.Mui-selected, &.Mui-selected:hover, &.Mui-selected.Mui-focusVisible': {
      backgroundColor: neutral.gray0,
    },
  },
});

export { Bar, Field, FieldLabel, SearchBox, selectRowStyles, ViewSelect };
