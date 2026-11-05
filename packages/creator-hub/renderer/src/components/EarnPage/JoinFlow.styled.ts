import { styled } from 'decentraland-ui2';

import { StatusBody } from './EarnModal.styled';

const CheckingBody = styled(StatusBody)({
  gap: 20,
});

const ResultBody = styled(StatusBody)({
  gap: 50,
  '& .MuiButton-root': { width: '100%' },
});

const ReasonLine = styled('span')({
  display: 'block',
});

const WelcomeImage = styled('img')({
  position: 'absolute',
  zIndex: 0,
  width: 263.5,
  height: 221,
  left: 'calc(50% - 131.75px - 10.7px)',
  top: 39 - 221,
  pointerEvents: 'none',
});

export { CheckingBody, ReasonLine, ResultBody, WelcomeImage };
