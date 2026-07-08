import type { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { Button } from '../Button';
import { COLORS, SPACING, TYPE } from '../theme';
import { createVideoPlayerControls, getAdminToolkitVideoControl } from './utils';
import { DEFAULT_VOLUME, ICONS, VOLUME_STEP } from '.';

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
      <UiEntity uiTransform={{ margin: { top: SPACING.xs } }}>
        <UiEntity
          uiTransform={{
            width: 24,
            height: 24,
            margin: { right: SPACING.sm },
          }}
          uiBackground={{
            textureMode: 'stretch',
            texture: {
              src: ICONS.MUTE,
            },
            color: COLORS.textSecondary,
          }}
        />
        <Label
          value="Sound is disabled for all screens"
          color={COLORS.textSecondary}
          fontSize={TYPE.body}
        />
        <UiEntity
          uiTransform={{
            width: 25,
            height: 25,
            margin: { left: SPACING.sm },
          }}
          uiBackground={{
            textureMode: 'stretch',
            texture: {
              src: ICONS.INFO,
            },
            color: COLORS.textSecondary,
          }}
        />
      </UiEntity>
    );
  }

  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'column',
        margin: { top: SPACING.lg },
      }}
    >
      <Label
        value={label}
        fontSize={TYPE.label}
        color={COLORS.textPrimary}
        uiTransform={{
          margin: { top: 0, right: 0, bottom: SPACING.sm, left: 0 },
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
          variant="secondary"
          fontSize={TYPE.button}
          uiTransform={{
            margin: { top: 0, right: SPACING.lg, bottom: 0, left: 0 },
            width: 49,
            height: 42,
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
          iconBackground={{ color: COLORS.textPrimary }}
          onMouseDown={() => controls.setVolume(-VOLUME_STEP)}
          disabled={isSoundDisabled || video?.volume === 0}
        />
        <Label
          value={volumePercentage}
          fontSize={TYPE.subtitle}
          color={COLORS.textSecondary}
          uiTransform={{
            margin: { top: 0, right: SPACING.lg, bottom: 0, left: 0 },
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            width: 60,
          }}
        />
        <Button
          id={`${idPrefix}_plus`}
          value="Plus"
          variant="secondary"
          fontSize={TYPE.button}
          icon={ICONS.VOLUME_PLUS_BUTTON}
          onlyIcon={true}
          iconTransform={{
            width: 25,
            height: 25,
          }}
          iconBackground={{ color: COLORS.textPrimary }}
          uiTransform={{
            margin: { top: 0, right: SPACING.lg, bottom: 0, left: 0 },
            width: 49,
            height: 42,
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
          fontSize={TYPE.subtitle}
          iconTransform={{ width: 24, height: 24 }}
          onlyIcon
          icon={ICONS.MUTE}
          iconBackground={{
            color: COLORS.textPrimary,
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
