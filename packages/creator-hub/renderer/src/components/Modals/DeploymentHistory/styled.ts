import { styled } from 'decentraland-ui2';

export const Container = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  maxHeight: 600,
  overflowY: 'auto',
});

export const NoDeployments = styled('div')({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 32,
  color: 'var(--dark-gray)',
});

export const DeploymentCard = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  padding: 10,
  border: '1px solid var(--dark-gray)',
  borderRadius: 8,
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
});

export const Header = styled('div')({
  color: 'var(--dcl-silver)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 20,
});

export const HeaderLeft = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  flex: 1,
});

export const Title = styled('div')({
  display: 'flex',
  alignItems: 'center',
  textTransform: 'uppercase',
  gap: 12,
  '& .Loader': {
    width: 'inherit',
    marginRight: 0,
  },
  '& .Warning': {
    backgroundSize: 'contain',
    width: 40,
    marginRight: 0,
  },
});

export const CurrentBadge = styled('div')({
  padding: '4px 12px',
  backgroundColor: 'rgba(55, 179, 74, 0.2)',
  border: '1px solid #37b34a',
  borderRadius: 12,
  color: '#37b34a',
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  alignSelf: 'flex-start',
});

export const DeploymentMeta = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: '#A09BA8',
});

export const ErrorMessage = styled('span')({
  color: 'var(--error)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  '& .ExpandMore': {
    marginLeft: -4,
  },
});

export const StepsContainer = styled('div')({
  marginBottom: 20,
});

export const Info = styled('div')({
  display: 'flex',
  flexDirection: 'row',
  backgroundColor: '#1764C03D',
  borderRadius: 8,
  padding: 20,
  color: 'var(--dcl-silver)',
  '& svg': {
    color: 'var(--twitter)',
  },
});
