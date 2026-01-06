import React, { useCallback, useState } from 'react';
import { type ActionPayload, type ActionType } from '@dcl/asset-packs';
import { recursiveCheck } from '../../../../lib/utils/deep-equal';
import { TextField, InfoTooltip } from '../../../ui';
import type { Props } from './types';

import './OpenLinkAction.css';

function isValid(
  payload: Partial<ActionPayload<ActionType.OPEN_LINK>>,
): payload is ActionPayload<ActionType.OPEN_LINK> {
  return typeof payload.url === 'string' && payload.url.length > 0;
}

const OpenLinkAction: React.FC<Props> = ({ value, onUpdate }: Props) => {
  const [payload, setPayload] = useState<Partial<ActionPayload<ActionType.OPEN_LINK>>>({
    ...value,
  });

  const handleUpdate = useCallback(
    (_payload: Partial<ActionPayload<ActionType.OPEN_LINK>>) => {
      setPayload(_payload);
      if (!recursiveCheck(_payload, value, 2) || !isValid(_payload)) return;
      onUpdate(_payload);
    },
    [setPayload, value, onUpdate],
  );

  const handleChangeEmote = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      handleUpdate({ ...payload, url: value });
    },
    [payload, handleUpdate],
  );

  const renderUrlInfo = () => {
    return (
      <InfoTooltip
        text="URL to open in a new browser tab when the action is triggered. Must be a valid HTTP or HTTPS URL."
        position="top center"
      />
    );
  };

  return (
    <div className="OpenLinkActionContainer">
      <div className="row">
        <TextField
          label={<>URL {renderUrlInfo()}</>}
          value={payload.url}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeEmote(e)}
          autoSelect
        />
      </div>
    </div>
  );
};

export default React.memo(OpenLinkAction);
