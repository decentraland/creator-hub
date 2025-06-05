import { Box, Button, IconButton, Typography } from 'decentraland-ui2';
import CloseIcon from '@mui/icons-material/Close';

import { Modal } from '../index';
import { t } from '/@/modules/store/translation/utils';
import InfluencePng from '/assets/images/influence.png';

import './styles.css';
import { InfoOutlined } from '@mui/icons-material';
import { Row } from '../../Row';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UpdateAvailableModal({ open, onClose }: Props) {
  return (
    <Modal
      size="tiny"
      open={open}
    >
      <Box className="UpdateAvailableModal">
        <div className="CloseButtonContainer">
          <IconButton onClick={onClose}>
            <CloseIcon fontSize="medium" />
          </IconButton>
        </div>
        <Typography variant="h5">{t('modal.app_settings.update.update_available')}</Typography>
        <Typography
          variant="body1"
          className="version"
        >
          {t('modal.app_settings.version.label', { version: '3.4.5' })}
        </Typography>
        <Box className="ImageButtonContainer">
          <img
            src={InfluencePng}
            alt="Update available"
          />
          <Box className="ButtonContainer">
            <Button
              variant="contained"
              className="actionButton"
            >
              {t('modal.app_settings.update.update')}
            </Button>
            <Row className="update-settings__message-container">
              <InfoOutlined />
              <Typography variant="body2">{t('modal.app_settings.update.auto_restart')}</Typography>
            </Row>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}
