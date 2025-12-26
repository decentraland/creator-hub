import React, { useCallback } from 'react';
import { ActionPayload, ActionType } from '@dcl/asset-packs';
import { Color3 } from '@dcl/ecs-math';
import { Block } from '../../../Block';
import { CheckboxField, ColorField, TextField } from '../../../ui';
import { toHex, toColor3 } from '../../../ui/ColorField/utils';
import { Props } from './types';

const LightsModifyAction: React.FC<Props> = ({ value, onUpdate }) => {
  const handleChangeActive = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate({ ...value, active: e.target.checked });
    },
    [value, onUpdate],
  );

  const handleChangeColor = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const color = toColor3(e.target.value);
      onUpdate({ ...value, color });
    },
    [value, onUpdate],
  );

  const handleChangeIntensity = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const intensity = parseFloat(e.target.value);
      if (!isNaN(intensity)) {
        onUpdate({ ...value, intensity });
      }
    },
    [value, onUpdate],
  );

  return (
    <Block className="LightsModifyActionContainer">
      <div className="row">
        <div className="field inline">
          <CheckboxField
            label="Active"
            checked={value.active ?? true}
            onChange={handleChangeActive}
          />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <ColorField
            label="Color"
            value={toHex(value.color as Color3)}
            onChange={handleChangeColor}
          />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <TextField
            label="Intensity"
            type="number"
            value={value.intensity ?? 16000}
            onChange={handleChangeIntensity}
          />
        </div>
      </div>
    </Block>
  );
};

export default React.memo(LightsModifyAction);
