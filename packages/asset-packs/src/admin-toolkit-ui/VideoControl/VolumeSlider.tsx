import type { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ReactEcs is the JSX factory
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { COLORS, SPACING, TYPE } from '../theme';
import { FieldLabel, Icon } from '../Primitives';
import { Slider } from '../Controls';
import { createVideoPlayerControls, getAdminToolkitVideoControl } from './utils';

export function VolumeSlider({
  engine,
  entity,
  video,
}: {
  engine: IEngine;
  entity: Entity;
  video: DeepReadonlyObject<PBVideoPlayer> | undefined;
}) {
  const controls = createVideoPlayerControls(entity, engine);
  const isSoundDisabled = getAdminToolkitVideoControl(engine)?.disableVideoPlayersSound;
  const volume = video?.volume ?? 1;

  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%', margin: { top: SPACING.xl } }}>
      <FieldLabel text="Volume" />
      <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
        <Icon
          name="volume"
          size={18}
          color={COLORS.textSecondary}
          uiTransform={{ margin: { right: SPACING.lg } }}
        />
        {isSoundDisabled ? (
          <Label
            value="Sound is disabled for all screens"
            fontSize={TYPE.body}
            color={COLORS.textSecondary}
          />
        ) : (
          <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', flexGrow: 1 }}>
            <Slider
              value={volume}
              onSet={v => controls.setVolumeExact(v)}
            />
            <UiEntity
              uiTransform={{ margin: { left: SPACING.lg } }}
              uiText={{
                value: `${Math.round(volume * 100)}%`,
                fontSize: TYPE.body,
                color: COLORS.textPrimary,
              }}
            />
          </UiEntity>
        )}
      </UiEntity>
    </UiEntity>
  );
}
