import React, { useCallback, useMemo, useState } from 'react';
import { useDrop } from 'react-dnd';
import cx from 'classnames';
import { type ActionPayload, type ActionType } from '@dcl/asset-packs';
import { recursiveCheck } from '../../../../lib/utils/deep-equal';
import {
  isValidVolume,
  volumeFromMediaSource,
  volumeToMediaSource,
} from '../../../../lib/utils/media';
import { Block } from '../../../Block';
import { Dropdown, InfoTooltip, RangeField, TextField } from '../../../ui';
import { getNode, type LocalAssetDrop } from '../../../../lib/sdk/drag-drop';
import { isVideo } from '../../VideoPlayerInspector/utils';
import { withAssetDir } from '../../../../lib/data-layer/host/fs-utils';
import { useAppSelector } from '../../../../redux/hooks';
import { selectAssetCatalog } from '../../../../redux/app';
import { removeBasePath } from '../../../../lib/logic/remove-base-path';
import { isValid } from './utils';
import type { Props } from './types';

import './PlayVideoStreamAction.css';

enum PLAY_MODE {
  PLAY_ONCE = 'play-once',
  LOOP = 'loop',
}

const playModeOptions = [
  {
    label: 'Play Once',
    value: PLAY_MODE.PLAY_ONCE,
  },
  {
    label: 'Loop',
    value: PLAY_MODE.LOOP,
  },
];

const DROP_TYPES = ['local-asset'];

const PlayVideoStreamAction: React.FC<Props> = ({ value, onUpdate }: Props) => {
  const files = useAppSelector(selectAssetCatalog);
  const [payload, setPayload] = useState<Partial<ActionPayload<ActionType.PLAY_VIDEO_STREAM>>>({
    ...value,
  });

  const handleUpdate = useCallback(
    (_payload: Partial<ActionPayload<ActionType.PLAY_VIDEO_STREAM>>) => {
      setPayload(_payload);
      if (!recursiveCheck(_payload, value, 2) || !isValid(_payload)) return;
      onUpdate(_payload);
    },
    [setPayload, value, onUpdate],
  );

  const handleChangeSrc = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      handleUpdate({ ...payload, src: value });
    },
    [payload, handleUpdate],
  );

  const handleChangePlayMode = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLSelectElement>) => {
      handleUpdate({ ...payload, loop: value === PLAY_MODE.LOOP });
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

  const renderUrlInfo = useMemo(
    () => (
      <InfoTooltip
        text="Video URL to display in the Player."
        position="right center"
        link="https://docs.decentraland.org/creator/scenes-sdk7/media/video-playing#about-external-streaming"
      />
    ),
    [],
  );

  const handleDrop = useCallback(
    async (src: string) => {
      handleUpdate({ ...payload, src });
    },
    [payload, handleUpdate],
  );

  const [{ isHover, canDrop }, drop] = useDrop(
    () => ({
      accept: DROP_TYPES,
      drop: ({ value, context }: LocalAssetDrop, monitor) => {
        if (monitor.didDrop()) return;
        const node = context.tree.get(value)!;
        const model = getNode(node, context.tree, isVideo);
        if (model) void handleDrop(withAssetDir(model.asset.src));
      },
      canDrop: ({ value, context }: LocalAssetDrop) => {
        const node = context.tree.get(value)!;
        return !!getNode(node, context.tree, isVideo);
      },
      collect: monitor => ({
        isHover: monitor.canDrop() && monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [files],
  );

  return (
    <div className={cx('PlayVideoStreamActionContainer', { hover: isHover, droppeable: canDrop })}>
      <Block ref={drop}>
        <TextField
          type="text"
          className="FileUploadInput"
          label={<>Video {renderUrlInfo}</>}
          value={removeBasePath(files?.basePath ?? '', payload.src ?? '')}
          onChange={handleChangeSrc}
          autoSelect
        />
      </Block>
      <Block>
        <Dropdown
          label="Play Mode"
          value={payload.loop ? PLAY_MODE.LOOP : PLAY_MODE.PLAY_ONCE}
          options={playModeOptions}
          onChange={handleChangePlayMode}
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

export default React.memo(PlayVideoStreamAction);
