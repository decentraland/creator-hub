import { useState } from 'react';
import { LinearProgress } from 'decentraland-ui2';

import type { DeployUpload } from '/@/lib/deploy';
import type { CancelRejection } from '/@/modules/store/deployment/deploy-api';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { t } from '/@/modules/store/translation/utils';
import { formatSize } from '/@/modules/file';

import { Button } from '/@/components/Button';

import './styles.css';

/** What the deployment allows about cancelling it. */
export type DeployCancel =
  | { kind: 'hidden' }
  /** Shown without allowing it: the CLI would turn the request down. */
  | { kind: 'unsupported' }
  /** The CLI reports a cancellation under way. */
  | { kind: 'cancelling' }
  /** `onCancel` resolves with why the CLI turned the request down, or `null` when it took it. */
  | { kind: 'available'; onCancel: () => Promise<CancelRejection | null> };

type Props = {
  upload?: DeployUpload | null;
  cancel: DeployCancel;
};

type CancelRequest = 'idle' | 'sent' | CancelRejection;

const REJECTION_NOTICES: Record<CancelRejection, TranslationPath> = {
  'too-early': 'modal.publish_project.deploy.deploying.progress.cancel_too_early',
  unauthorized: 'modal.publish_project.deploy.deploying.progress.cancel_unauthorized',
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

/** Rendered per deployment (`key`), so a cancel request never carries over to the next one. */
export function DeployProgress({ upload, cancel }: Props) {
  const [request, setRequest] = useState<CancelRequest>('idle');

  if (!upload && cancel.kind === 'hidden') return null;

  const determinate = upload?.stage === 'uploading' && upload.totalBytes > 0;

  const handleCancel = async () => {
    if (cancel.kind !== 'available') return;
    setRequest('sent');
    try {
      setRequest((await cancel.onCancel()) ?? 'sent');
    } catch {
      setRequest('idle');
    }
  };

  const cancelling = cancel.kind === 'cancelling' || request === 'sent';
  const notice =
    cancel.kind === 'unsupported'
      ? t('modal.publish_project.deploy.deploying.progress.cancel_unsupported')
      : request === 'too-early' || request === 'unauthorized'
        ? t(REJECTION_NOTICES[request])
        : undefined;

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
      {cancel.kind !== 'hidden' && (
        <div className="cancel">
          {notice && (
            <span
              className="notice"
              role="status"
            >
              {notice}
            </span>
          )}
          <Button
            size="medium"
            variant="outlined"
            color="secondary"
            disabled={cancelling || cancel.kind === 'unsupported'}
            onClick={handleCancel}
          >
            {cancelling
              ? t('modal.publish_project.deploy.deploying.actions.cancelling')
              : t('modal.publish_project.deploy.deploying.actions.cancel')}
          </Button>
        </div>
      )}
    </div>
  );
}
