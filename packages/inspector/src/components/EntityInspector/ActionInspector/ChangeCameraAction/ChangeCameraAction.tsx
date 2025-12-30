import React, { useCallback, useMemo } from 'react';
import type { Entity } from '@dcl/ecs';
import { ActionPayload, ActionType } from '@dcl/asset-packs';
import { Dropdown } from '../../../ui';
import { withSdk } from '../../../../hoc/withSdk';
import { Props } from './types';

const ChangeCameraAction: React.FC<Props & { sdk: any }> = ({ value, onUpdate, sdk }) => {
  const { engine } = sdk;
  const { Name, Nodes } = sdk.components;
  const VirtualCamera = sdk.components.VirtualCamera;

  const options = useMemo(() => {
    const cameraOptions: Array<{ label: string; value: string }> = [{ label: 'None', value: '' }];

    if (VirtualCamera) {
      const entities = engine.getEntitiesWith(VirtualCamera);
      if (entities) {
        for (const [entity, _component] of entities) {
          if (
            entity !== engine.RootEntity &&
            entity !== engine.PlayerEntity &&
            entity !== engine.CameraEntity
          ) {
            const entityName = Name.getOrNull(entity)?.value ?? entity.toString();
            cameraOptions.push({
              label: entityName,
              value: entity.toString(),
            });
          }
        }
      }
    }

    return cameraOptions;
  }, [engine, VirtualCamera, Name]);

  const handleChangeEntity = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedValue = e.target.value;
      const entityId = selectedValue === '' ? undefined : (parseInt(selectedValue, 10) as Entity);
      onUpdate({ ...value, virtualCameraEntity: entityId });
    },
    [value, onUpdate],
  );

  const currentValue = value.virtualCameraEntity?.toString() ?? '';

  return (
    <div className="ChangeCameraActionContainer">
      <div className="row">
        <Dropdown
          label="Camera"
          options={options}
          value={currentValue}
          onChange={handleChangeEntity}
          placeholder="Select Camera"
        />
      </div>
    </div>
  );
};

export default React.memo(withSdk(ChangeCameraAction));
