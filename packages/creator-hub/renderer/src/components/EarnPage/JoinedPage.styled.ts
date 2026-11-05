import { styled, Tabs } from 'decentraland-ui2';

import { typeToken } from './tokens';

const Page = styled('div')({
  padding: '0 clamp(16px, 5.104vw, 98px) 60px',
  display: 'flex',
  flexDirection: 'column',
});

const GetReadyPage = styled(Page)({
  paddingBottom: 0,
});

const SectionTabs = styled(Tabs)({
  marginTop: 30,
  boxSizing: 'border-box',
  height: 40,
  minHeight: 40,
  boxShadow: 'inset 0 -1px 0 var(--palette-whiteTransparent-soft)',
  '& .MuiTabs-flexContainer': { gap: 40 },
  '& .MuiTabs-indicator': {
    bottom: 1,
    height: 2,
    backgroundColor: 'var(--palette-neutral-softWhite)',
  },
  '& .MuiTab-root': {
    ...typeToken('h6-semi-caps'),
    minWidth: 0,
    minHeight: 40,
    padding: '10px 4px',
    textTransform: 'uppercase',
    color: 'var(--dcl-silver)',
    '&:hover': { backgroundColor: 'var(--palette-whiteTransparent-subtle)' },
    '&.Mui-selected': { color: 'var(--palette-neutral-softWhite)' },
    '&:focus-visible': {
      outline: '2px solid var(--palette-info-light)',
      outlineOffset: -2,
    },
  },
});

const TabPanel = styled('div')({
  marginTop: 30,
});

const GradientDefs = styled('svg')({
  position: 'absolute',
  width: 0,
  height: 0,
});

export { GetReadyPage, GradientDefs, Page, SectionTabs, TabPanel };
