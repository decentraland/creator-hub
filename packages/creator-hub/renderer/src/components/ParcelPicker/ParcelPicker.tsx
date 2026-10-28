import React, { useEffect, useRef, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded';
import { Box, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { type AtlasScene } from '/@/components/WorldAtlas';
import { Button } from '/@/components/Button';
import { Loader } from '/@/components/Loader';
import { AvatarWithInfo } from '../AvatarWithInfo';
import { ParcelPickerMap } from './ParcelPickerMap';
import './styles.css';

type Props = {
  walletAddress: string;
  scenes: AtlasScene[];
  initialParcels: Set<string>;
  allowed?: Set<string>;
  title: string;
  description: string;
  saving: boolean;
  onConfirm: (parcels: string[]) => void;
  onGoBack: () => void;
};

/** Picks parcels on the atlas by click or drag, optionally limited to an allowed set. */
export const ParcelPicker: React.FC<Props> = React.memo(
  ({
    walletAddress,
    scenes,
    initialParcels,
    allowed,
    title,
    description,
    saving,
    onConfirm,
    onGoBack,
  }) => {
    const [selectedParcels, setSelectedParcels] = useState<Set<string>>(initialParcels);
    const hasChangesRef = useRef(false);

    useEffect(() => {
      setSelectedParcels(initialParcels);
      hasChangesRef.current = false;
    }, [initialParcels]);

    const handleChange = (next: Set<string>) => {
      setSelectedParcels(next);
      hasChangesRef.current = true;
    };

    const handleReset = () => {
      setSelectedParcels(initialParcels);
      hasChangesRef.current = false;
    };

    return (
      <Box className="ParcelPicker">
        <Box className="HeaderTitle">
          <ArrowBackIcon
            role="button"
            onClick={onGoBack}
          />
          <Typography variant="h6">{title}</Typography>
        </Box>
        <Typography
          variant="h6"
          className="Description"
        >
          {description}
        </Typography>
        <ParcelPickerMap
          label={title}
          height={350}
          scenes={scenes}
          allowed={allowed}
          selected={selectedParcels}
          onChange={handleChange}
          floatingContent={
            <AvatarWithInfo
              value={walletAddress}
              size="tiny"
            />
          }
        />
        <Box className="ActionsContainer">
          {hasChangesRef.current && (
            <Button
              onClick={handleReset}
              variant="outlined"
              color="secondary"
            >
              {t('modal.world_permissions.parcels.actions.discard')}
            </Button>
          )}
          <Typography>
            {t('parcel_picker.count', {
              count: selectedParcels.size || '',
            })}
          </Typography>
          <Button
            onClick={() => onConfirm(Array.from(selectedParcels))}
            disabled={!hasChangesRef.current}
            className="SaveButton"
          >
            {saving ? <Loader size={24} /> : t('modal.world_permissions.parcels.actions.confirm')}
          </Button>
        </Box>
      </Box>
    );
  },
);
