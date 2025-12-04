import { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { Color4 } from '@dcl/ecs-math';
import { getScaleUIFactor } from '../../ui';
import { Button } from '../Button';
import { createVideoPlayerControls, getAdminToolkitVideoControl } from './utils';
import { COLORS, DEFAULT_VOLUME, ICONS, VOLUME_STEP } from '.';

export function VideoControlVolume({
  engine,
  label,
  entity,
  video,
}: {
  engine: IEngine;
  label: string;
  entity: Entity;
  video: DeepReadonlyObject<PBVideoPlayer> | undefined;
}) {
  const scaleFactor = getScaleUIFactor(engine);
  const controls = createVideoPlayerControls(entity, engine);
  const videoControl = getAdminToolkitVideoControl(engine);
  const isSoundDisabled = videoControl?.disableVideoPlayersSound;
  const volumePercentage = `${Math.round((video?.volume ?? DEFAULT_VOLUME) * 100)}%`;

  if (isSoundDisabled) {
    return (
      <UiEntity uiTransform={{ margin: { top: 4 * scaleFactor } }}>
        <UiEntity
          uiTransform={{
            width: 24 * scaleFactor,
            height: 24 * scaleFactor,
            margin: { right: 8 * scaleFactor },
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
          fontSize={14 * scaleFactor}
        />
        <UiEntity
          uiTransform={{
            width: 25 * scaleFactor,
            height: 25 * scaleFactor,
            margin: { left: 8 * scaleFactor },
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
        margin: { top: 16 * scaleFactor },
      }}
    >
      <Label
        value={label}
        fontSize={16 * scaleFactor}
        color={COLORS.WHITE}
        uiTransform={{
          margin: { top: 0, right: 0, bottom: 10 * scaleFactor, left: 0 },
        }}
      />

      <UiEntity
        uiTransform={{
          flexDirection: 'row',
        }}
      >
        <Button
          id="video_control_volume_minus"
          value="Minus"
          fontSize={14 * scaleFactor}
          uiTransform={{
            margin: { top: 0, right: 16 * scaleFactor, bottom: 0, left: 0 },
            width: 49 * scaleFactor,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          icon={ICONS.VOLUME_MINUS_BUTTON}
          onlyIcon={true}
          iconTransform={{
            width: 25 * scaleFactor,
            height: 25 * scaleFactor,
          }}
          onMouseDown={() => controls.setVolume(-VOLUME_STEP)}
          disabled={isSoundDisabled || !video?.volume}
        />
        <Label
          value={volumePercentage}
          fontSize={18 * scaleFactor}
          color={COLORS.GRAY}
          uiTransform={{
            margin: { top: 0, right: 16 * scaleFactor, bottom: 0, left: 0 },
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            width: 60 * scaleFactor,
          }}
        />
        <Button
          id="video_control_volume_plus"
          value="Plus"
          fontSize={14 * scaleFactor}
          icon={ICONS.VOLUME_PLUS_BUTTON}
          onlyIcon={true}
          iconTransform={{
            width: 25 * scaleFactor,
            height: 25 * scaleFactor,
          }}
          uiTransform={{
            margin: { top: 0, right: 16 * scaleFactor, bottom: 0, left: 0 },
            width: 49 * scaleFactor,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          onMouseDown={() => controls.setVolume(VOLUME_STEP)}
          disabled={isSoundDisabled || video?.volume === 1}
        />
        <Button
          id="video_control_volume_mute"
          variant={!video?.volume ? 'primary' : 'secondary'}
          fontSize={18 * scaleFactor}
          iconTransform={{ width: 24 * scaleFactor, height: 24 * scaleFactor }}
          onlyIcon
          icon={ICONS.MUTE}
          iconBackground={{
            color: video?.volume ? Color4.White() : Color4.Black(),
          }}
          uiTransform={{
            borderColor: Color4.fromHexString('#FCFCFC'),
            borderWidth: 2,
            width: 49 * scaleFactor,
            height: 42 * scaleFactor,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          onMouseDown={() => {
            controls.setVolume(!video?.volume ? 100 : 0);
          }}
          disabled={isSoundDisabled}
        />
      </UiEntity>
    </UiEntity>
  );
}
