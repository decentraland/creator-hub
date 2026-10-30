import { useState } from 'react';
import { Typography } from 'decentraland-ui2';

import { useDispatch } from '#store';
import { unpublishEntireWorld } from '/@/modules/store/management';
import { t } from '/@/modules/store/translation/utils';

import { Button } from '../../Button';
import { Loader } from '../../Loader';
import { Modal } from '../../Modals';

/** Confirms unpublishing every scene of `worldName`; closed while it is null. */
export function UnpublishWorldModal({
  worldName,
  onClose,
}: {
  worldName: string | null;
  onClose: () => void;
}) {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  const unpublish = async () => {
    if (!worldName || loading) return;
    try {
      setLoading(true);
      await dispatch(unpublishEntireWorld({ worldName })).unwrap();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={!!worldName}
      className="UnpublishConfirmationModal"
      actions={
        <>
          <Button
            color="secondary"
            onClick={onClose}
          >
            {t('modal.cancel')}
          </Button>
          <Button
            onClick={unpublish}
            disabled={loading}
          >
            {loading ? <Loader size={24} /> : t('modal.confirm')}
          </Button>
        </>
      }
    >
      <Typography variant="h5">
        {t('manage.unpublish_world_confirmation.title', {
          worldName,
          b: (chunks: string) => <b>{chunks}</b>,
        })}
      </Typography>
    </Modal>
  );
}
