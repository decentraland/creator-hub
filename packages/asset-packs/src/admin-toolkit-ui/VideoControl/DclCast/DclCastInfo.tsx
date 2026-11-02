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
import { Surface, Divider } from '../../Primitives';
import { CopyRow, ActionLink } from '../../Controls';
import { icon } from '../../icons';
import { setStream, dismissPresentation } from '../../actions';
import { VolumeSlider } from '../VolumeSlider';
import PresentationPanel from './PresentationPanel';

// Speakers showcase button — shown whenever the cast room is active, both while
// presenting and idle. flexGrow lets it sit beside "Share presentation" (half
// width) or stand alone (full width).
function SpeakersButton({ onShowShowcaseModal }: { onShowShowcaseModal: () => Promise<void> }) {
  return (
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
  );
}

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

  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
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

      <VolumeSlider
        engine={engine}
        entity={entity}
        video={video}
      />

      {/* Speakers stays available whether presenting or idle. */}
      <UiEntity
        uiTransform={{ flexDirection: 'column', width: '100%', margin: { top: SPACING.xl } }}
      >
        {state.videoControl.presentationState ? (
          <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
            <PresentationPanel
              presentationState={state.videoControl.presentationState}
              idPrefix="dcl_cast"
              onStopSharing={() => dismissPresentation()}
            />
            <UiEntity
              uiTransform={{ flexDirection: 'row', width: '100%', margin: { top: SPACING.md } }}
            >
              <SpeakersButton onShowShowcaseModal={onShowShowcaseModal} />
            </UiEntity>
          </UiEntity>
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
            <SpeakersButton onShowShowcaseModal={onShowShowcaseModal} />
          </UiEntity>
        )}
      </UiEntity>

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
