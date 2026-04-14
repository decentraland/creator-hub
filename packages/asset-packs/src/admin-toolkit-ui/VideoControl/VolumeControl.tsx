import type { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { Color4 } from '@dcl/ecs-math';
import { Button } from '../Button';
import { createVideoPlayerControls, getAdminToolkitVideoControl } from './utils';
import { COLORS, DEFAULT_VOLUME, ICONS, VOLUME_STEP } from '.';

export function VideoControlVolume({
  engine,
  label,
  entity,
  video,
  idPrefix = 'video_control_volume',
}: {
  engine: IEngine;
  label: string;
  entity: Entity;
  video: DeepReadonlyObject<PBVideoPlayer> | undefined;
  idPrefix?: string;
}) {
  const controls = createVideoPlayerControls(entity, engine);
  const videoControl = getAdminToolkitVideoControl(engine);
  const isSoundDisabled = videoControl?.disableVideoPlayersSound;
  const volumePercentage = `${Math.round((video?.volume ?? DEFAULT_VOLUME) * 100)}%`;

  if (isSoundDisabled) {
    return (
      <UiEntity uiTransform={{ margin: { top: 4 } }}>
        <UiEntity
          uiTransform={{
            width: 24,
            height: 24,
            margin: { right: 8 },
          }}
          uiBackground={{
            textureMode: 'stretch',
            texture: {
              src: ICONS.MUTE,
            },
            color: Color4.fromHexString('#A09BA8'),
          }}
        />
        <Label
          value="Sound is disabled for all screens"
          color={Color4.fromHexString('#A09BA8')}
          fontSize={14}
        />
        <UiEntity
          uiTransform={{
            width: 25,
            height: 25,
            margin: { left: 8 },
          }}
          uiBackground={{
            textureMode: 'stretch',
            texture: {
              src: ICONS.INFO,
            },
            color: Color4.White(),
          }}
        />
      </UiEntity>
    );
  }

  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'column',
        margin: { top: 16 },
      }}
    >
      <Label
        value={label}
        fontSize={16}
        color={COLORS.WHITE}
        uiTransform={{
          margin: { top: 0, right: 0, bottom: 10, left: 0 },
        }}
      />

      <UiEntity
        uiTransform={{
          flexDirection: 'row',
        }}
      >
        <Button
          id={`${idPrefix}_minus`}
          value="Minus"
          fontSize={14}
          uiTransform={{
            margin: { top: 0, right: 16, bottom: 0, left: 0 },
            width: 49,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          icon={ICONS.VOLUME_MINUS_BUTTON}
          onlyIcon={true}
          iconTransform={{
            width: 25,
            height: 25,
          }}
          onMouseDown={() => controls.setVolume(-VOLUME_STEP)}
          disabled={isSoundDisabled || video?.volume === 0}
        />
        <Label
          value={volumePercentage}
          fontSize={18}
          color={COLORS.GRAY}
          uiTransform={{
            margin: { top: 0, right: 16, bottom: 0, left: 0 },
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            width: 60,
          }}
        />
        <Button
          id={`${idPrefix}_plus`}
          value="Plus"
          fontSize={14}
          icon={ICONS.VOLUME_PLUS_BUTTON}
          onlyIcon={true}
          iconTransform={{
            width: 25,
            height: 25,
          }}
          uiTransform={{
            margin: { top: 0, right: 16, bottom: 0, left: 0 },
            width: 49,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          onMouseDown={() => controls.setVolume(VOLUME_STEP)}
          disabled={isSoundDisabled || video?.volume === 1}
        />
        <Button
          id={`${idPrefix}_mute`}
          variant={video?.volume === 0 ? 'primary' : 'secondary'}
          fontSize={18}
          iconTransform={{ width: 24, height: 24 }}
          onlyIcon
          icon={ICONS.MUTE}
          iconBackground={{
            color: video?.volume === 0 ? Color4.Black() : Color4.White(),
          }}
          uiTransform={{
            width: 49,
            height: 42,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          onMouseDown={() => {
            controls.setVolume(video?.volume === 0 ? 100 : 0);
          }}
          disabled={isSoundDisabled}
        />
      </UiEntity>
    </UiEntity>
  );
}
