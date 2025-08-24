import React, { useCallback, useState } from 'react';
import { ActionPayload, ActionType, ProximityLayer } from '@dcl/asset-packs';
import { deepEqual } from 'fast-equals';
import { Dropdown, TextField } from '../../../ui';
import { type Props, LayerOptions } from './types';

import './TriggerProximityAction.css';

function isValid(
  payload: Partial<ActionPayload<ActionType.DAMAGE>>,
): payload is ActionPayload<ActionType.DAMAGE> {
  return typeof payload.radius === 'number' && !isNaN(payload.radius);
}

const TriggerProximityAction: React.FC<Props> = ({ value, onUpdate }: Props) => {
  const [payload, setPayload] = useState<Partial<ActionPayload<ActionType.DAMAGE>>>({
    ...value,
  });

  const handleUpdate = useCallback(
    (_payload: Partial<ActionPayload<ActionType.DAMAGE>>) => {
      setPayload(_payload);
      if (!deepEqual(_payload, value) || !isValid(_payload)) return;
      onUpdate(_payload);
    },
    [setPayload, value, onUpdate],
  );

  const handleChangeRadius = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      handleUpdate({ ...payload, radius: parseFloat(value) });
    },
    [payload, handleUpdate],
  );

  const handleChangeHits = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      handleUpdate({ ...payload, hits: parseInt(value) });
    },
    [payload, handleUpdate],
  );

  const handleChangeLayer = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLSelectElement>) => {
      handleUpdate({ ...payload, layer: value as ProximityLayer });
    },
    [payload, handleUpdate],
  );

  return (
    <div className="TriggerProximityActionContainer">
      <div className="row">
        <TextField
          label="Radius"
          type="number"
          value={payload.radius}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeRadius(e)}
          autoSelect
        />
        <TextField
          label="Hits"
          type="number"
          value={payload.hits || 1}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeHits(e)}
          autoSelect
        />
        <Dropdown
          label="Layer"
          options={LayerOptions}
          value={payload.layer || ProximityLayer.ALL}
          onChange={handleChangeLayer}
        />
      </div>
    </div>
  );
};

export default React.memo(TriggerProximityAction);
