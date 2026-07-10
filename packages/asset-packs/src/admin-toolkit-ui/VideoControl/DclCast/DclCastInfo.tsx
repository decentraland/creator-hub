import type { Entity, IEngine } from '@dcl/ecs';
import type { DeepReadonlyObject, PBVideoPlayer } from '@dcl/ecs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ReactEcs is the JSX factory
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { copyToClipboard } from '~system/RestrictedActions';
import { Button } from '../../Button';
import type { State } from '../../types';
import { LIVEKIT_STREAM_SRC } from '../LiveStream';
import { createVideoPlayerControls, isDclCast } from '../utils';
import { COLORS, RADIUS, SPACING, TYPE } from '../../theme';
import { FieldLabel, Surface, Divider, Icon } from '../../Primitives';
import { CopyRow, Slider, ActionLink } from '../../Controls';
import { icon } from '../../icons';
import { setStream, dismissPresentation } from '../../actions';
import PresentationPanel from './PresentationPanel';

const DclCastInfo = ({
  state,
  engine,
  onResetRoomId,
  onShowShowcaseModal,
  onSharePresentation,
  entity,
  video,
}: {
  state: State;
  engine: IEngine;
  onResetRoomId: () => Promise<void>;
  onShowShowcaseModal: () => Promise<void>;
  onSharePresentation: () => void;
  entity: Entity;
  video: DeepReadonlyObject<PBVideoPlayer> | undefined;
}) => {
  const controls = createVideoPlayerControls(entity, engine);
  const active = !!(video?.src && isDclCast(video.src));
  const volume = video?.volume ?? 1;

  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
      {/* Access links */}
      <Surface>
        <CopyRow
          id="dcl_cast_copy_stream_link"
          badge="mic"
          badgeVariant="magenta"
          title="Speaker link"
          description="Grants streaming access"
          onCopy={() =>
            state.videoControl.dclCast?.streamLink &&
            copyToClipboard({ text: state.videoControl.dclCast.streamLink })
          }
        />
        <UiEntity
          uiTransform={{ width: '100%', height: 1 }}
          uiBackground={{ color: COLORS.border }}
        />
        <CopyRow
          id="dcl_cast_copy_watcher_link"
          badge="eye"
          badgeVariant="blue"
          title="Viewer link"
          description="Grants viewing access"
          onCopy={() =>
            state.videoControl.dclCast?.watcherLink &&
            copyToClipboard({ text: state.videoControl.dclCast.watcherLink })
          }
        />
      </Surface>

      {/* Volume */}
      <UiEntity
        uiTransform={{ flexDirection: 'column', width: '100%', margin: { top: SPACING.xl } }}
      >
        <FieldLabel text="Volume" />
        <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
          <Icon
            name="volume"
            size={18}
            color={COLORS.textSecondary}
            uiTransform={{ margin: { right: SPACING.lg } }}
          />
          <Slider
            value={volume}
            onSet={v => controls.setVolumeExact(v)}
          />
          <Label
            value={`${Math.round(volume * 100)}%`}
            fontSize={TYPE.body}
            color={COLORS.textPrimary}
            uiTransform={{ margin: { left: SPACING.lg } }}
          />
        </UiEntity>
      </UiEntity>

      {/* Primary actions — presentation controls while presenting, otherwise
          the Share presentation / Speakers row. */}
      <UiEntity
        uiTransform={{ flexDirection: 'column', width: '100%', margin: { top: SPACING.xl } }}
      >
        {state.videoControl.presentationState ? (
          <PresentationPanel
            presentationState={state.videoControl.presentationState}
            idPrefix="dcl_cast"
            onStopSharing={() => dismissPresentation()}
          />
        ) : (
          <UiEntity
            uiTransform={{
              flexDirection: 'row',
              width: '100%',
              display: active ? 'flex' : 'none',
            }}
          >
            <Button
              id="dcl_cast_share_presentation_id"
              value="<b>Share presentation</b>"
              variant="primary"
              fontSize={TYPE.body}
              icon={icon('presentation')}
              iconTransform={{ width: 16, height: 16, margin: { right: SPACING.sm } }}
              iconBackground={{ color: COLORS.white }}
              uiTransform={{
                flexGrow: 1,
                flexBasis: 0,
                minWidth: 0,
                height: 40,
                borderRadius: RADIUS.md,
                alignItems: 'center',
                justifyContent: 'center',
                margin: { right: SPACING.md },
              }}
              onMouseDown={onSharePresentation}
            />
            <Button
              id="dcl_cast_showcase_list"
              value="<b>Speakers</b>"
              variant="secondary"
              fontSize={TYPE.body}
              color={COLORS.textTertiary}
              icon={icon('star')}
              iconTransform={{ width: 16, height: 16, margin: { right: SPACING.sm } }}
              iconBackground={{ color: COLORS.textTertiary }}
              uiTransform={{
                flexGrow: 1,
                flexBasis: 0,
                minWidth: 0,
                height: 40,
                borderRadius: RADIUS.md,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseDown={onShowShowcaseModal}
            />
          </UiEntity>
        )}
      </UiEntity>

      {/* Bottom row: activate/deactivate + reset */}
      <UiEntity
        uiTransform={{ flexDirection: 'column', width: '100%', margin: { top: SPACING.xl } }}
      >
        <Divider />
        <UiEntity
          uiTransform={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            margin: { top: SPACING.xl },
          }}
        >
          <ActionLink
            label={active ? 'Deactivate room' : 'Activate room'}
            iconName="power"
            color={COLORS.textSecondary}
            onClick={() => {
              if (active) {
                controls.setSource('');
                setStream(undefined);
              } else {
                controls.setSource(LIVEKIT_STREAM_SRC);
                setStream('dcl-cast');
              }
            }}
          />
          <ActionLink
            label="Reset room"
            iconName="refresh"
            color={COLORS.danger}
            onClick={onResetRoomId}
          />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  );
};

export default DclCastInfo;
