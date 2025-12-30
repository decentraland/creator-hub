import React, { useCallback, useState } from 'react';
import { type ActionPayload, type ActionType } from '@dcl/asset-packs';
import { recursiveCheck } from '../../../../lib/utils/deep-equal';
import { Dropdown, Label } from '../../../ui';
import RangeHourField from '../../../ui/RangeHourField/RangeHourField';
import { TransitionMode } from '../../../../lib/sdk/components/SceneMetadata';
import { MIDDAY_SECONDS } from '../../SceneInspector/utils';
import type { Props } from './types';

import './ChangeSkyboxAction.css';

function isValid(
  payload: Partial<ActionPayload<ActionType.CHANGE_SKYBOX>>,
): payload is ActionPayload<ActionType.CHANGE_SKYBOX> {
  return payload.time !== undefined && typeof payload.time === 'number';
}

const ChangeSkyboxAction: React.FC<Props> = ({ value, onUpdate }: Props) => {
  const [payload, setPayload] = useState<Partial<ActionPayload<ActionType.CHANGE_SKYBOX>>>({
    time: value.time ?? MIDDAY_SECONDS,
    direction: value.direction,
  });

  const handleUpdate = useCallback(
    (_payload: Partial<ActionPayload<ActionType.CHANGE_SKYBOX>>) => {
      setPayload(_payload);
      if (!recursiveCheck(_payload, value, 2) || !isValid(_payload)) return;
      onUpdate(_payload as ActionPayload<ActionType.CHANGE_SKYBOX>);
    },
    [setPayload, value, onUpdate],
  );

  const handleChangeTime = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseInt(e.target.value, 10);
      handleUpdate({ ...payload, time });
    },
    [payload, handleUpdate],
  );

  const handleChangeDirection = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLSelectElement>) => {
      const direction = value === '' ? undefined : parseInt(value, 10);
      handleUpdate({ ...payload, direction });
    },
    [payload, handleUpdate],
  );

  return (
    <div className="ChangeSkyboxActionContainer">
      <div className="row">
        <div className="field">
          <Label text="Skybox Time" />
          <RangeHourField
            value={payload.time ?? MIDDAY_SECONDS}
            onChange={handleChangeTime}
          />
        </div>
        <div className="field">
          <Dropdown
            label="Direction"
            placeholder="Select Direction"
            options={[
              { value: '', label: 'Undefined' },
              { value: TransitionMode.TM_FORWARD.toString(), label: 'Forward' },
              { value: TransitionMode.TM_BACKWARD.toString(), label: 'Backward' },
            ]}
            value={payload.direction?.toString() ?? ''}
            onChange={handleChangeDirection}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(ChangeSkyboxAction);
