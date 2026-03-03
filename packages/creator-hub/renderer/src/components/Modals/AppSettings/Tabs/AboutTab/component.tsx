import { Box, Button, Link, Typography } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';
import { UpdateSettings } from '../../UpdateSettings';
import type { AboutTabProps } from '../../types';
import logo from '/assets/images/logo-editor.png';

import './styles.css';

const AboutTab: React.FC<AboutTabProps> = ({ version, onViewChangelog, onSubmitFeedback }) => {
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
          {version && (
            <Box className="AboutVersionRow">
              <Typography variant="body2">{`v${version}`}</Typography>
              <Link
                component="button"
                onClick={onViewChangelog}
                className="AboutChangelogLink"
              >
                {t('modal.app_settings.about.view_changelog')}
              </Link>
            </Box>
          )}
        </Box>
      </Box>
      <Box className="AboutFeedbackSection">
        <Button
          variant="outlined"
          color="secondary"
          size="medium"
          className="AboutFeedbackButton"
          onClick={onSubmitFeedback}
        >
          {t('navbar.report_an_issue')}
        </Button>
      </Box>
      <Box className="AboutUpdateSection">
        <UpdateSettings className="AboutUpdateSettings" />
      </Box>
    </Box>
  );
};

export default AboutTab;
