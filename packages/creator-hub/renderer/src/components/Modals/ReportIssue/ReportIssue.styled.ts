import { dclColors, styled } from 'decentraland-ui2';

import { ExternalLink } from '../../ExternalLink';
import { primaryLinkStyles } from '../../LandDetailPage/DetailsTab/DetailsTab.styled';

const { neutral } = dclColors;

const Form = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
}));

const HelpLink = styled(ExternalLink)(primaryLinkStyles);

const Hint = styled('span')(({ theme }) => ({
  color: neutral.gray3,
  fontSize: theme.typography.pxToRem(14),
  lineHeight: 'normal',
}));

const LogsOption = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.75),
}));

export { Form, HelpLink, Hint, LogsOption };
