import { Box, Link, Typography } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';
import { UpdateSettings } from '../../UpdateSettings';
import type { AboutTabProps } from '../../types';
import logo from '/assets/images/logo-editor.png';

import './styles.css';

const AboutTab: React.FC<AboutTabProps> = ({ version, onViewChangelog }) => {
  return (
    <Box className="AboutTabContainer">
      <Box className="AboutHeader">
        <img
          src={logo}
          alt="Decentraland Creator Hub"
          className="AboutLogo"
        />
        <Box className="AboutInfo">
          <Typography
            variant="h5"
            className="AboutTitle"
          >
            {t('modal.app_settings.about.title')}
          </Typography>
          <Box className="AboutVersionRow">
            <Typography variant="body2">{version ? `v${version}` : ''}</Typography>
            <Link
              component="button"
              onClick={onViewChangelog}
              className="AboutChangelogLink"
            >
              {t('modal.app_settings.about.view_changelog')}
            </Link>
          </Box>
        </Box>
      </Box>
      <Box className="AboutUpdateSection">
        <UpdateSettings className="AboutUpdateSettings" />
      </Box>
    </Box>
  );
};

export default AboutTab;
