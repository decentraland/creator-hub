import { Box, styled } from 'decentraland-ui2';

const CardActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  flexWrap: 'wrap',
}));

const CardHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  width: '100%',
}));

const DetailsList = styled('ul')(({ theme }) => ({
  margin: 0,
  paddingLeft: theme.spacing(2.5),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.75),
  color: theme.palette.text.secondary,
  fontSize: theme.typography.caption.fontSize,
  lineHeight: 1.4,
}));

const DetailsToggle = styled('button')(({ theme }) => ({
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: theme.palette.text.primary,
  fontSize: theme.typography.caption.fontSize,
  textDecoration: 'underline',
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}));

const SharingChip = styled('button', {
  shouldForwardProp: prop => prop !== 'excluded',
})<{ excluded: boolean }>(({ theme, excluded }) => ({
  padding: theme.spacing(0.25, 1),
  borderRadius: theme.spacing(1.5),
  border: `1px solid ${excluded ? theme.palette.divider : theme.palette.primary.main}`,
  background: 'none',
  cursor: 'pointer',
  color: excluded ? theme.palette.text.secondary : theme.palette.text.primary,
  fontSize: theme.typography.caption.fontSize,
  whiteSpace: 'nowrap',
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}));

export { CardActions, CardHeader, DetailsList, DetailsToggle, SharingChip };
