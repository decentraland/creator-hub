import { Button } from 'decentraland-ui2';

import { Actions, Description } from '/@/components/ErrorBoundary';
import { t } from '/@/modules/store/translation/utils';

import { PublishModal } from './PublishModal';

type Props = {
  open: boolean;
  onClose: () => void;
  onRetry: () => void;
};

export function PublishErrorFallback({ open, onClose, onRetry }: Props) {
  return (
    <PublishModal
      open={open}
      size="tiny"
      title={t('error_boundary.title')}
      onClose={onClose}
    >
      <Description
        role="alert"
        variant="body1"
        data-testid="publish-error-fallback"
      >
        {t('error_boundary.modal_description')}
      </Description>
      <Actions>
        <Button
          color="secondary"
          variant="contained"
          onClick={onClose}
        >
          {t('error_boundary.close')}
        </Button>
        <Button
          color="primary"
          variant="contained"
          onClick={onRetry}
        >
          {t('error_boundary.try_again')}
        </Button>
      </Actions>
    </PublishModal>
  );
}
