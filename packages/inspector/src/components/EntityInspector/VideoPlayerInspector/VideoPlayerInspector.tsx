import { useCallback, useMemo } from 'react';
import { useDrop } from 'react-dnd';
import cx from 'classnames';
import { LIVEKIT_STREAM_SRC } from '@dcl/asset-packs';
import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { getComponentValue } from '../../../hooks/sdk/useComponentValue';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { CoreComponents } from '../../../lib/sdk/components';
import { type LocalAssetDrop, getNode } from '../../../lib/sdk/drag-drop';
import { withAssetDir } from '../../../lib/data-layer/host/fs-utils';
import { useAppSelector } from '../../../redux/hooks';
import { selectAssetCatalog } from '../../../redux/app';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { TextField, CheckboxField, RangeField, InfoTooltip } from '../../ui';
import { fromVideoPlayer, toVideoPlayer, isVideo, isValidVolume } from './utils';
import type { Props } from './types';

import './VideoPlayerInspector.css';

const DROP_TYPES = ['local-asset'];

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const files = useAppSelector(selectAssetCatalog);
  const { VideoPlayer, GltfContainer } = sdk.components;

  const hasVideoPlayer = useHasComponent(entity, VideoPlayer);

  const { getInputProps, isValid } = useComponentInput(
    entity,
    VideoPlayer,
    fromVideoPlayer(files?.basePath ?? ''),
    toVideoPlayer(files?.basePath ?? ''),
    () => true,
    [files],
  );

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, VideoPlayer);
    await sdk.operations.dispatch();
    const gltfContainer = getComponentValue(entity, GltfContainer);
    const asset = getAssetByModel(gltfContainer.src);
    analytics.track(Event.REMOVE_COMPONENT, {
      componentName: CoreComponents.VIDEO_PLAYER,
      itemId: asset?.id,
      itemPath: gltfContainer.src,
    });
  }, []);

  const handleDrop = useCallback(async (src: string) => {
    const { operations } = sdk;
    operations.updateValue(VideoPlayer, entity, { src });
    await operations.dispatch();
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

  const playing = getInputProps('playing', e => e.target.checked);
  const loop = getInputProps('loop', e => e.target.checked);
  const volume = getInputProps('volume', e => e.target.value);
  const src = getInputProps('src');

  const isVideoURLDisabled = useMemo(() => {
    return src?.value === LIVEKIT_STREAM_SRC;
  }, [src.value]);

  if (!hasVideoPlayer) return null;

  return (
    <Container
      label="VideoPlayer"
      className={cx('VideoPlayer', { hover: isHover, droppeable: canDrop })}
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="In case of using an URL, it must be an https URL (http URLs aren't supported), and the source should have CORS policies (Cross Origin Resource Sharing) that permit externally accessing it"
          link="https://docs.decentraland.org/creator/development-guide/sdk7/audio-streaming"
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      <Block
        label="Path/URL"
        ref={drop}
      >
        <TextField
          autoSelect
          type="text"
          className="FileUploadInput"
          {...src}
          error={files && !isValid}
          drop={isHover}
          disabled={isVideoURLDisabled}
        />
      </Block>
      <Block label="Playback">
        <CheckboxField
          label="Start playing"
          checked={!!playing.value}
          {...playing}
        />
        <CheckboxField
          label="Loop"
          checked={!!loop.value}
          {...loop}
        />
      </Block>
      <Block
        className="volume"
        label="Volume"
      >
        <RangeField
          {...volume}
          isValidValue={isValidVolume}
        />
      </Block>
    </Container>
  );
});
