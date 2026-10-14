import { LinearProgress } from 'decentraland-ui2';

import type { DeployUpload } from '/@/lib/deploy';
import { t } from '/@/modules/store/translation/utils';
import { formatSize } from '/@/modules/file';

import { Button } from '/@/components/Button';

import './styles.css';

type Props = {
  upload?: DeployUpload | null;
  canCancel: boolean;
  cancelling: boolean;
  onCancel: () => void;
};

function getPercent({ sentBytes, totalBytes }: DeployUpload) {
  return totalBytes > 0 ? Math.min(100, Math.round((sentBytes / totalBytes) * 100)) : 0;
}

function getMessage(upload: DeployUpload) {
  switch (upload.stage) {
    case 'checking':
      return t('modal.publish_project.deploy.deploying.progress.checking');
    case 'processing':
      return t('modal.publish_project.deploy.deploying.progress.processing');
    default:
      return t('modal.publish_project.deploy.deploying.progress.uploading', {
        sent: formatSize(upload.sentBytes),
        total: formatSize(upload.totalBytes),
      });
  }
}

export function DeployProgress({ upload, canCancel, cancelling, onCancel }: Props) {
  if (!upload && !canCancel) return null;

  const determinate = upload?.stage === 'uploading' && upload.totalBytes > 0;

  return (
    <div className="DeployProgress">
      {upload && (
        <div className="upload">
          <LinearProgress
            aria-label={t('modal.publish_project.deploy.deploying.step.uploading')}
            variant={determinate ? 'determinate' : 'indeterminate'}
            value={determinate ? getPercent(upload) : undefined}
          />
          <div className="details">
            <span className="message">{getMessage(upload)}</span>
            {upload.totalBatches ? (
              <span className="batches">
                {t('modal.publish_project.deploy.deploying.progress.batches', {
                  completed: upload.completedBatches ?? 0,
                  total: upload.totalBatches,
                })}
              </span>
            ) : null}
          </div>
        </div>
      )}
      {canCancel && (
        <Button
          className="cancel"
          size="medium"
          variant="outlined"
          color="secondary"
          disabled={cancelling}
          onClick={onCancel}
        >
          {cancelling
            ? t('modal.publish_project.deploy.deploying.actions.cancelling')
            : t('modal.publish_project.deploy.deploying.actions.cancel')}
        </Button>
      )}
    </div>
  );
}
