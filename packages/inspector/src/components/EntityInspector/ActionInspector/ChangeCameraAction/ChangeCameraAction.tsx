import React, { useCallback } from 'react';
import type { Entity } from '@dcl/ecs';
import { ActionPayload, ActionType } from '@dcl/asset-packs';
import { EntityField } from '../../../ui';
import { withSdk } from '../../../../hoc/withSdk';
import { Props } from './types';

const ChangeCameraAction: React.FC<Props & { sdk: any }> = ({ value, onUpdate, sdk }) => {
  const handleChangeEntity = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const entityId = parseInt(e.target.value) as Entity;
      onUpdate({ ...value, virtualCameraEntity: entityId || undefined });
    },
    [value, onUpdate],
  );

  return (
    <div className="ChangeCameraActionContainer">
      <div className="row">
        <EntityField
          label="Camera"
          value={value.virtualCameraEntity}
          onChange={handleChangeEntity}
          components={[sdk.components.VirtualCamera]}
        />
      </div>
    </div>
  );
};

export default React.memo(withSdk(ChangeCameraAction));
