import { Link } from 'react-router-dom';
import { styled } from 'decentraland-ui2';

import { ExternalLink } from '../../../../ExternalLink';
import { primaryLinkStyles } from '../../../../LandDetailPage/DetailsTab/DetailsTab.styled';

const HelpCenterLink = styled(ExternalLink)(props => ({
  ...primaryLinkStyles(props),
  alignSelf: 'center',
  marginRight: 'auto',
}));

const SettingsLink = styled(Link)(primaryLinkStyles);

export { HelpCenterLink, SettingsLink };
