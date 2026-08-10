import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, IconButton, Typography } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';
import logo from '/assets/images/logo-editor.png';
import { Modal } from '../index';

import type { Props } from './types';

import './styles.css';

export function About({ open, version, onClose }: Props) {
  return (
    <Modal
      size="tiny"
      open={open}
      onClose={onClose}
    >
      <Box className="AboutModal">
        <div className="AboutModalHeader">
          <Typography variant="body1">{t('modal.about.title')}</Typography>
          <IconButton
            aria-label="close"
            onClick={onClose}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <div className="AboutModalBody">
          <img
            className="AboutModalLogo"
            src={logo}
            alt="Decentraland Creator Hub"
          />
          <Typography
            variant="h6"
            className="AboutModalName"
          >
            {t('modal.about.app_name')}
          </Typography>
          {version && (
            <Typography
              variant="body2"
              className="AboutModalVersion"
            >
              {`v${version}`}
            </Typography>
          )}
          <Button
            className="AboutModalAction"
            variant="contained"
            fullWidth
            onClick={onClose}
          >
            {t('modal.about.action')}
          </Button>
        </div>
      </Box>
    </Modal>
  );
}
