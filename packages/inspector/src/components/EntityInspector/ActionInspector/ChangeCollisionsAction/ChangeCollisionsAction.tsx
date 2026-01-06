import React, { useCallback, useState } from 'react';
import { type ActionPayload, type ActionType } from '@dcl/asset-packs';
import { recursiveCheck } from '../../../../lib/utils/deep-equal';
import { Dropdown } from '../../../ui';
import { COLLISION_LAYERS } from '../../GltfInspector/utils';
import type { Props } from './types';

import './ChangeCollisionsAction.css';

function isValid(
  payload: Partial<ActionPayload<ActionType.CHANGE_COLLISIONS>>,
): payload is ActionPayload<ActionType.CHANGE_COLLISIONS> {
  // Both values can be undefined (action will be a no-op)
  return true;
}

const ChangeCollisionsAction: React.FC<Props> = ({ value, onUpdate }: Props) => {
  const [payload, setPayload] = useState<Partial<ActionPayload<ActionType.CHANGE_COLLISIONS>>>({
    ...value,
  });

  const handleUpdate = useCallback(
    (_payload: Partial<ActionPayload<ActionType.CHANGE_COLLISIONS>>) => {
      setPayload(_payload);
      if (!recursiveCheck(_payload, value, 2) || !isValid(_payload)) return;
      onUpdate(_payload as ActionPayload<ActionType.CHANGE_COLLISIONS>);
    },
    [setPayload, value, onUpdate],
  );

  const handleChangeVisibleCollisions = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLSelectElement>) => {
      const collisionValue = value === '' ? undefined : parseInt(value, 10);
      handleUpdate({ ...payload, visibleCollisions: collisionValue });
    },
    [payload, handleUpdate],
  );

  const handleChangeInvisibleCollisions = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLSelectElement>) => {
      const collisionValue = value === '' ? undefined : parseInt(value, 10);
      handleUpdate({ ...payload, invisibleCollisions: collisionValue });
    },
    [payload, handleUpdate],
  );

  const collisionOptions = [
    { value: '', label: 'Undefined' },
    ...COLLISION_LAYERS.map(layer => ({
      value: layer.value.toString(),
      label: layer.label,
    })),
  ];

  return (
    <div className="ChangeCollisionsActionContainer">
      <div className="row">
        <div className="field">
          <Dropdown
            label="Visible collisions"
            placeholder="Select Visible Collisions"
            options={collisionOptions}
            value={payload.visibleCollisions?.toString() ?? ''}
            onChange={handleChangeVisibleCollisions}
          />
        </div>
        <div className="field">
          <Dropdown
            label="Invisible collisions"
            placeholder="Select Invisible Collisions"
            options={collisionOptions}
            value={payload.invisibleCollisions?.toString() ?? ''}
            onChange={handleChangeInvisibleCollisions}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(ChangeCollisionsAction);
