import { styled } from 'decentraland-ui2';

import { typeToken } from '../tokens';

const Panel = styled('aside')({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  padding: 30,
  boxSizing: 'border-box',
  borderRadius: 'var(--shape-borderRadiusXLarge)',
  backgroundColor: 'var(--palette-whiteTransparent-subtle)',
});

const Heading = styled('h2')({
  ...typeToken('h5-semi'),
  margin: 0,
  color: 'var(--palette-neutral-softWhite)',
});

const Entry = styled('article')({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  '& + &': {
    borderTop: '1px solid var(--palette-whiteTransparent-subtle)',
    paddingTop: 20,
  },
});

const EntryDate = styled('time')({
  ...typeToken('h7-regular'),
  color: 'var(--gray)',
});

const EntryTitle = styled('h3')({
  ...typeToken('h6-semi'),
  margin: 0,
  overflowWrap: 'anywhere',
  color: 'var(--palette-neutral-softWhite)',
});

const EntryBody = styled('p')({
  ...typeToken('h6-regular'),
  margin: 0,
  overflowWrap: 'anywhere',
  color: 'var(--gray)',
});

export { Entry, EntryBody, EntryDate, EntryTitle, Heading, Panel };
