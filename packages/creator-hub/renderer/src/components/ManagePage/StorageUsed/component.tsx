import React, { useCallback, useState } from 'react';
import { Button, CircularProgress, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { toMB } from '/@/modules/file';
import { useSelector } from '#store';
import { WorldsYourStorageModal } from '../../Modals/WorldsYourStorageModal';
import './styles.css';

const StorageUsed = React.memo(() => {
  const { storageStats, accountHoldings } = useSelector(state => state.management);
  const [openDetailsModal, setOpenDetailsModal] = useState(false);
  const maxMbs = toMB(Number(storageStats?.maxAllowedSpace) || 0);
  const currentMbs = toMB(Number(storageStats?.usedSpace) || 0);
  const usedPercentage = (currentMbs * 100) / maxMbs;

  const onViewDetails = useCallback(() => {
    setOpenDetailsModal(true);
  }, []);

  if (!storageStats) return null;

  return (
    <div className="StorageUsed">
      <Typography
        variant="h6"
        className="MainTitle"
      >
        {t('manage.worlds_storage.used')}
      </Typography>
      <Typography>{t('manage.worlds_storage.for_names')}</Typography>
      <Typography className="Description">{t('manage.worlds_storage.description')}</Typography>
      <Button
        variant="text"
        onClick={onViewDetails}
        size="small"
        className="DetailsButton"
      >
        {t('manage.worlds_storage.link')}
      </Button>

      <CircularProgress
        value={usedPercentage}
        variant="determinate"
        className="Progress"
        size={150}
        thickness={7}
      />
      <p className="ProgressValues">
        <span className="UsedValue">{currentMbs.toFixed(2)}</span> / {maxMbs.toFixed(0)} MB
      </p>

      <WorldsYourStorageModal
        open={openDetailsModal}
        onClose={() => setOpenDetailsModal(false)}
        stats={storageStats}
        accountHoldings={accountHoldings}
      />
    </div>
  );
});

export { StorageUsed };
