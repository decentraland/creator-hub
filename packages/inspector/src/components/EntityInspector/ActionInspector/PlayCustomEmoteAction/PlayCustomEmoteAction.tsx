import React, { useCallback, useMemo, useState } from 'react';
import { type ActionPayload, type ActionType } from '@dcl/asset-packs';
import { recursiveCheck } from '../../../../lib/utils/deep-equal';
import { CheckboxField, FileUploadField, InfoTooltip } from '../../../ui';
import { ACCEPTED_FILE_TYPES } from '../../../ui/FileUploadField/types';
import { useAppSelector } from '../../../../redux/hooks';
import { selectAssetCatalog } from '../../../../redux/app';
import { useAssetOptions } from '../../../../hooks/useAssetOptions';
import { addBasePath } from '../../../../lib/logic/add-base-path';
import type { Props } from './types';
import { isModel } from './utils';

import './PlayCustomEmoteAction.css';

function isValid(
  payload: Partial<ActionPayload<ActionType.PLAY_CUSTOM_EMOTE>>,
): payload is ActionPayload<ActionType.PLAY_CUSTOM_EMOTE> {
  return typeof payload.src === 'string';
}

const PlayCustomEmoteAction: React.FC<Props> = ({ value, onUpdate }: Props) => {
  const modelOptions = useAssetOptions(ACCEPTED_FILE_TYPES['model']);
  const [payload, setPayload] = useState<Partial<ActionPayload<ActionType.PLAY_CUSTOM_EMOTE>>>({
    ...value,
  });

  const files = useAppSelector(selectAssetCatalog);

  const handleUpdate = useCallback(
    (_payload: Partial<ActionPayload<ActionType.PLAY_CUSTOM_EMOTE>>) => {
      setPayload(_payload);
      if (!recursiveCheck(_payload, value, 2) || !isValid(_payload)) return;
      onUpdate(_payload);
    },
    [setPayload, value, onUpdate],
  );

  const handleDrop = useCallback(
    (path: string) => {
      handleUpdate({ ...payload, src: path });
    },
    [payload, handleUpdate],
  );

  const handleChangeSrc = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const path = addBasePath(files?.basePath ?? '', e.target.value);
      handleUpdate({ ...payload, src: path });
    },
    [payload, handleUpdate, files?.basePath],
  );

  const handleChangeLoop = useCallback(
    ({ target: { checked } }: React.ChangeEvent<HTMLInputElement>) => {
      handleUpdate({ ...payload, loop: checked });
    },
    [payload, handleUpdate],
  );

  const error = useMemo(() => {
    if (!files || !payload.src) {
      return false;
    }
    return !files.assets.some($ => $.path === payload.src);
  }, [files, payload]);

  const renderPathInfo = useMemo(
    () => (
      <InfoTooltip
        text="Drag and drop a custom emote model file from the Local Assets, or click the foler icon to search for files. The file should be a .glb or .gltf 3D model with animation."
        link="https://docs.decentraland.org/creator/scenes-sdk7/interactivity/player-avatar#custom-animations"
        position="right center"
      />
    ),
    [],
  );

  return (
    <div className="PlayCustomEmoteActionContainer">
      <div className="row">
        <FileUploadField
          label={<>File Path {renderPathInfo}</>}
          value={payload.src}
          accept={ACCEPTED_FILE_TYPES['model']}
          options={modelOptions}
          onDrop={handleDrop}
          onChange={handleChangeSrc}
          error={files && (!isValid || error)}
          isValidFile={isModel}
        />
        <CheckboxField
          label={
            <>
              Loop{' '}
              <InfoTooltip
                text="When enabled, the emote animation will loop continuously. When disabled, it plays once."
                position="top center"
              />
            </>
          }
          checked={payload.loop}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChangeLoop(e)}
        />
      </div>
    </div>
  );
};

export default React.memo(PlayCustomEmoteAction);
