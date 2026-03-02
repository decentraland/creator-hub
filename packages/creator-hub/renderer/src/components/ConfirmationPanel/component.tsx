import React from 'react';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Typography } from 'decentraland-ui2';
import { Button } from '/@/components/Button';
import './styles.css';

type Props = {
  title: string;
  warning: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

const ConfirmationPanel: React.FC<Props> = React.memo(
  ({ title, warning, cancelLabel, confirmLabel, onCancel, onConfirm }) => {
    return (
      <Box className="ConfirmationPanel">
        <Typography
          variant="h5"
          className="ConfirmationPanelTitle"
        >
          {title}
        </Typography>
        <Box className="ConfirmationPanelWarning">
          <WarningAmberIcon fontSize="small" />
          <Typography variant="body2">{warning}</Typography>
        </Box>
        <Box className="ConfirmationPanelActions">
          <Button
            onClick={onCancel}
            color="secondary"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            color="primary"
          >
            {confirmLabel}
          </Button>
        </Box>
      </Box>
    );
  },
);

export { ConfirmationPanel };
