import { useState } from 'react';

import { t } from '/@/modules/store/translation/utils';
import type { AtlasScene } from '/@/components/WorldAtlas';

import { DefaultModal, type ModalStep } from '../Modals/DefaultModal';
import { AvatarWithInfo } from '../AvatarWithInfo';
import type { Allowed } from './cursor';
import { ParcelPickerMap } from './ParcelPickerMap';
import { AtlasBlock, Count, Description } from './ParcelPicker.styled';

type Props = {
  open: boolean;
  name: string;
  walletAddress: string;
  scenes: AtlasScene[];
  initialParcels: Set<string>;
  allowed: Allowed;
  onCancel: () => void;
  onConfirm: (parcels: string[]) => void;
  next?: ModalStep;
};

/** Picks a collaborator's parcels in a DefaultModal; `next` replaces the picker in the same modal. */
export function ParcelPickerModal({
  open,
  name,
  walletAddress,
  scenes,
  initialParcels,
  allowed,
  onCancel,
  onConfirm,
  next,
}: Props) {
  const [selected, setSelected] = useState(initialParcels);

  if (next) {
    return (
      <DefaultModal
        open={open}
        {...next}
      />
    );
  }

  return (
    <DefaultModal
      open={open}
      title={t('parcel_picker.title')}
      onClose={onCancel}
      secondary={{ label: t('modal.cancel'), onClick: onCancel }}
      primary={{
        label: t('modal.confirm'),
        state: selected.size ? 'idle' : 'blocked',
        onClick: () => onConfirm([...selected]),
      }}
    >
      <AvatarWithInfo value={walletAddress} />
      <Description>{t('parcel_picker.description')}</Description>
      <AtlasBlock>
        <ParcelPickerMap
          label={t('parcel_picker.map_label', { name })}
          scenes={scenes}
          allowed={allowed}
          selected={selected}
          onChange={setSelected}
          height={360}
        />
        <Count
          role="status"
          aria-live="polite"
        >
          {t('parcel_picker.count', { count: selected.size })}
        </Count>
      </AtlasBlock>
    </DefaultModal>
  );
}
