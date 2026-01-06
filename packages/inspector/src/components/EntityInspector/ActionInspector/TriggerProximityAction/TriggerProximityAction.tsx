import React, { useCallback, useState } from 'react';
import { type ActionPayload, type ActionType, ProximityLayer } from '@dcl/asset-packs';
import { recursiveCheck } from '../../../../lib/utils/deep-equal';
import { Dropdown, TextField, InfoTooltip } from '../../../ui';
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
      if (!recursiveCheck(_payload, value, 2) || !isValid(_payload)) return;
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

  const renderRadiusInfo = () => {
    return (
      <InfoTooltip
        text="The radius in meters around the entity where players will trigger the damage effect."
        position="top center"
      />
    );
  };

  const renderHitsInfo = () => {
    return (
      <InfoTooltip
        text="The number of times the damage effect will be applied. Each hit reduces the player's health."
        position="top center"
      />
    );
  };

  const renderLayerInfo = () => {
    return (
      <InfoTooltip
        text="Select which layers are affected by the damage. 'All' affects the player and all items with health, 'Player' affects only players, 'Non Player' affects only items with health."
        position="top center"
      />
    );
  };

  return (
    <div className="TriggerProximityActionContainer">
      <div className="row">
        <TextField
          label={<>Radius {renderRadiusInfo()}</>}
          type="number"
          value={payload.radius}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeRadius(e)}
          autoSelect
        />
        <TextField
          label={<>Hits {renderHitsInfo()}</>}
          type="number"
          value={payload.hits || 1}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeHits(e)}
          autoSelect
        />
        <Dropdown
          label={<>Layer {renderLayerInfo()}</>}
          options={LayerOptions}
          value={payload.layer || ProximityLayer.ALL}
          onChange={handleChangeLayer}
        />
      </div>
    </div>
  );
};

export default React.memo(TriggerProximityAction);
