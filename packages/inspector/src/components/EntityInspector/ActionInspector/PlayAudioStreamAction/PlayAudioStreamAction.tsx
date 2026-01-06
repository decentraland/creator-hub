import React, { useCallback, useState } from 'react';
import { type ActionPayload, type ActionType } from '@dcl/asset-packs';
import { recursiveCheck } from '../../../../lib/utils/deep-equal';
import {
  isValidVolume,
  volumeFromMediaSource,
  volumeToMediaSource,
} from '../../../../lib/utils/media';
import { Block } from '../../../Block';
import { RangeField, TextField, InfoTooltip } from '../../../ui';
import { isValid } from './utils';
import type { Props } from './types';

import './PlayAudioStreamAction.css';

const PlayAudioStreamAction: React.FC<Props> = ({ value, onUpdate }: Props) => {
  const [payload, setPayload] = useState<Partial<ActionPayload<ActionType.PLAY_AUDIO_STREAM>>>({
    ...value,
  });

  const handleUpdate = useCallback(
    (_payload: Partial<ActionPayload<ActionType.PLAY_AUDIO_STREAM>>) => {
      setPayload(_payload);
      if (!recursiveCheck(_payload, value, 2) || !isValid(_payload)) return;
      onUpdate(_payload);
    },
    [setPayload, value, onUpdate],
  );

  const handleChangeUrl = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      handleUpdate({ ...payload, url: value });
    },
    [payload, handleUpdate],
  );

  const handleChangeVolume = useCallback(
    (e: React.ChangeEvent<HTMLElement>) => {
      const { value } = e.target as HTMLInputElement;

      if (isValidVolume(value)) {
        handleUpdate({ ...payload, volume: volumeToMediaSource(value) });
      }
    },
    [payload, handleUpdate],
  );

  const renderUrlInfo = () => {
    return (
      <InfoTooltip
        text="Audio URL to stream. Must be HTTPS with CORS policies that permit external access. Supported formats: .mp3, .ogg, .aac"
        link="https://docs.decentraland.org/creator/scenes-sdk7/media/audio-streaming"
        position="right center"
      />
    );
  };

  return (
    <div className="PlayAudioStreamActionContainer">
      <Block>
        <TextField
          label={<>URL {renderUrlInfo()}</>}
          value={payload.url}
          onChange={handleChangeUrl}
          autoSelect
        />
      </Block>
      <Block>
        <RangeField
          label="Volume"
          value={volumeFromMediaSource(value.volume)}
          onChange={handleChangeVolume}
          isValidValue={isValidVolume}
        />
      </Block>
    </div>
  );
};

export default React.memo(PlayAudioStreamAction);
