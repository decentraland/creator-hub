import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import { AiOutlineInfoCircle as InfoIcon } from 'react-icons/ai';
import cx from 'classnames';
import { MediaSource, LIVEKIT_STREAM_SRC } from '@dcl/asset-packs';
import { withSdk } from '../../../../../hoc/withSdk';
import { useComponentValue } from '../../../../../hooks/sdk/useComponentValue';
import { isValidHttpsUrl } from '../../../../../lib/utils/url';
import { Block } from '../../../../Block';
import { Container } from '../../../../Container';
import {
  CheckboxField,
  CheckboxGroup,
  Dropdown,
  Label,
  RangeField,
  TextField,
} from '../../../../ui';
import { useAppSelector } from '../../../../../redux/hooks';
import { selectAssetCatalog } from '../../../../../redux/app';
import { isValidVolume, isVideo } from '../../../VideoPlayerInspector/utils';
import { type Props } from '../../../AdminToolkitView/types';
import { type LocalAssetDrop, getNode } from '../../../../../lib/sdk/drag-drop';
import { withAssetDir } from '../../../../../lib/data-layer/host/fs-utils';
import { removeBasePath } from '../../../../../lib/logic/remove-base-path';

import './VideoScreenBasicView.css';

const DROP_TYPES = ['local-asset'];

const VideoScreenBasicView = withSdk<Props>(({ sdk, entity }) => {
  const files = useAppSelector(selectAssetCatalog);
  const { VideoScreen, VideoPlayer } = sdk.components;
  const [videoScreenComponent, setVideoScreenComponent] = useComponentValue(entity, VideoScreen);
  const [videoPlayerComponent, setVideoPlayerComponent] = useComponentValue(entity, VideoPlayer);
  const [isValidURL, setIsValidURL] = useState(true);

  const handleVideoMediaSourceChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      if (!videoScreenComponent) return;
      const value = Number(event.target.value) as MediaSource;

      setVideoScreenComponent({
        ...videoScreenComponent,
        defaultMediaSource: value,
        defaultURL: value === MediaSource.LiveStream ? LIVEKIT_STREAM_SRC : '',
      });
      if (value === MediaSource.LiveStream) {
        setIsValidURL(true);
      }
    },
    [videoScreenComponent, setVideoScreenComponent],
  );

  const handleCheckboxChange = useCallback(
    (property: 'loop' | 'playing') => (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!videoPlayerComponent) return;
      setVideoPlayerComponent({
        ...videoPlayerComponent,
        [property]: e.target.checked,
      });
    },
    [videoPlayerComponent, setVideoPlayerComponent],
  );

  useEffect(() => {
    if (
      videoScreenComponent.defaultMediaSource === MediaSource.LiveStream &&
      videoPlayerComponent.src !== LIVEKIT_STREAM_SRC
    ) {
      setVideoPlayerComponent({
        ...videoPlayerComponent,
        src: LIVEKIT_STREAM_SRC,
      });
    }
    if (videoScreenComponent.defaultMediaSource === MediaSource.VideoURL) {
      setVideoPlayerComponent({
        ...videoPlayerComponent,
        src: videoScreenComponent.defaultURL,
      });
    }
  }, [videoScreenComponent.defaultMediaSource, videoScreenComponent.defaultURL]);

  useEffect(() => {
    if (videoPlayerComponent.src !== videoScreenComponent.defaultURL) {
      setVideoScreenComponent({
        ...videoScreenComponent,
        defaultURL: videoPlayerComponent.src,
      });
    }
  }, [videoPlayerComponent.src]);

  const handleDrop = useCallback(async (src: string) => {
    if (videoScreenComponent.defaultMediaSource === MediaSource.VideoURL) {
      setVideoScreenComponent({
        ...videoScreenComponent,
        defaultURL: src,
      });
      setVideoPlayerComponent({
        ...videoPlayerComponent,
        src,
      });
    }
    setIsValidURL(true);
  }, []);

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

  const isVideoURLDisabled = useMemo(() => {
    return videoScreenComponent.defaultMediaSource === MediaSource.LiveStream;
  }, [videoScreenComponent.defaultMediaSource]);

  const handleVideoURLChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setVideoScreenComponent({ ...videoScreenComponent, defaultURL: value });
      if (isValidHttpsUrl(value)) {
        !isValidURL && setIsValidURL(true);
      } else if (isValidURL) {
        setIsValidURL(false);
      }
    },
    [videoScreenComponent, setVideoScreenComponent],
  );

  return (
    <div className="VideoScreenBasicViewInspector">
      <div className="Info">
        <InfoIcon size={16} />
        <Label text="Add the 'Admin Tools' Smart Item to your scene to modify the content and settings of this screen in-world." />
      </div>
      <Label
        className="Title"
        text="Default Settings"
      />
      <Block
        className="volume"
        label="Volume"
      >
        <RangeField
          value={Math.round((videoPlayerComponent.volume ?? 1) * 100)}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setVideoPlayerComponent({
              ...videoPlayerComponent,
              volume: Number(e.target.value) / 100,
            });
          }}
          isValidValue={isValidVolume}
        />
      </Block>
      <div className="Divider" />
      <Label
        className="Title"
        text="Media sources"
      />
      <Dropdown
        className="DefaultMediaSourcesDropdown"
        label="Default Media Sources"
        value={videoScreenComponent.defaultMediaSource ?? MediaSource.VideoURL}
        onChange={handleVideoMediaSourceChange}
        options={[
          { value: MediaSource.VideoURL, label: 'Video URL' },
          { value: MediaSource.LiveStream, label: 'Live Stream' },
        ]}
      />
      <Container
        label="Video"
        className={cx('Container', 'border', { hover: isHover, droppeable: canDrop })}
      >
        <Block
          label="Video Path or Vimeo URL"
          ref={drop}
        >
          <TextField
            autoSelect
            type="text"
            className="FileUploadInput"
            value={removeBasePath(files?.basePath ?? '', videoScreenComponent.defaultURL)}
            onChange={handleVideoURLChange}
            error={!isValidURL}
            disabled={isVideoURLDisabled}
          />
        </Block>
        <CheckboxGroup
          className="PlayBack"
          label="Playback"
        >
          <CheckboxField
            label="Auto play"
            checked={!!videoPlayerComponent?.playing}
            onChange={handleCheckboxChange('playing')}
          />
          <CheckboxField
            label="Loop"
            checked={!!videoPlayerComponent?.loop}
            onChange={handleCheckboxChange('loop')}
          />
        </CheckboxGroup>
      </Container>
      <Container
        label="Live Stream"
        className="Container border LiveStreamSection"
      >
        <InfoIcon size={16} />
        <Label text="Stream keys are generated from the Admin Tools panel in your scene in-world. Make sure to add the 'Admin Tools' Smart Item to your scene." />
      </Container>
    </div>
  );
});

export default React.memo(VideoScreenBasicView);
