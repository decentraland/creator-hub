import type { Entity, IEngine } from '@dcl/ecs';
import type { DeepReadonlyObject, PBVideoPlayer } from '@dcl/ecs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ReactEcs is required for JSX factory
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { Color4 } from '@dcl/sdk/math';
import { copyToClipboard } from '~system/RestrictedActions';
import { Button } from '../../Button';
import { getContentUrl } from '../../constants';
import { FeedbackButton } from '../../FeedbackButton';
import type { State } from '../../types';
import { nextTickFunctions } from '../..';
import { LIVEKIT_STREAM_SRC } from '../LiveStream';
import { VideoControlVolume } from '../VolumeControl';
import {
  getActiveStreams,
  groupTracksByParticipant,
  type FlattenedTrack,
  type Participant,
} from '../api';
import { createVideoPlayerControls, isDclCast } from '../utils';
import { getDclCastStyles, getDclCastColors, getDclCastBackgrounds } from './styles';

const ICONS = {
  get COPY_TO_CLIPBOARD_ICON() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/copy-to-clipboard.png`;
  },
  get STAR() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/star.png`;
  },
};

export const showcaseState: {
  show: boolean;
  participants: Participant[];
  activeTrackSid: string | undefined;
  onSelectTrack: ((track: FlattenedTrack) => void) | undefined;
  onClose: (() => void) | undefined;
} = {
  show: false,
  participants: [],
  activeTrackSid: undefined,
  onSelectTrack: undefined,
  onClose: undefined,
};

const DclCastInfo = ({
  state,
  engine,
  onResetRoomId,
  entity,
  video,
}: {
  state: State;
  engine: IEngine;
  onResetRoomId: () => Promise<void>;
  entity: Entity;
  video: DeepReadonlyObject<PBVideoPlayer> | undefined;
}) => {
  const controls = createVideoPlayerControls(entity, engine);
  const styles = getDclCastStyles();
  const colors = getDclCastColors();
  const backgrounds = getDclCastBackgrounds();

  const onShowShowcaseModal = async () => {
    const latestTracks = await getActiveStreams();

    if (!latestTracks) return;

    const closeModal = () => {
      showcaseState.show = false;
    };

    showcaseState.participants = groupTracksByParticipant(latestTracks);
    showcaseState.activeTrackSid = video?.src;

    showcaseState.onSelectTrack = (track: FlattenedTrack) => {
      controls.setSource(track.sid);
      state.videoControl.selectedStream = 'dcl-cast';
      closeModal();
    };

    showcaseState.onClose = closeModal;

    nextTickFunctions.push(() => {
      showcaseState.show = true;
    });
  };

  return (
    <UiEntity uiTransform={styles.fullContainer}>
      <UiEntity uiTransform={styles.mainBorderedContainer}>
        <UiEntity uiTransform={styles.headerRow}>
          <UiEntity uiTransform={styles.columnFlexStart}>
            <Label
              value={'<b>Room ID</b>'}
              fontSize={24}
              color={Color4.White()}
            />
            <Label
              value={`Expires in ${state.videoControl.dclCast?.expiresInDays} days`}
              fontSize={14}
              color={colors.gray}
              uiTransform={styles.marginTopSmall}
            />
          </UiEntity>
          {video?.src && isDclCast(video.src) ? (
            <Button
              id="dcl_cast_deactivate"
              value="<b>Deactivate</b>"
              variant="text"
              fontSize={16}
              color={colors.white}
              uiTransform={styles.activateButton}
              onMouseDown={() => {
                controls.setSource('');
                state.videoControl.selectedStream = undefined;
              }}
            />
          ) : (
            <Button
              id="dcl_cast_activate"
              value="<b>Activate</b>"
              labelTransform={styles.activateButtonLabel}
              uiTransform={styles.activateButton}
              fontSize={16}
              uiBackground={backgrounds.success}
              color={colors.black}
              onMouseDown={() => {
                controls.setSource(LIVEKIT_STREAM_SRC);
                state.videoControl.selectedStream = 'dcl-cast';
              }}
            />
          )}
        </UiEntity>
        <UiEntity uiTransform={styles.columnContainer}>
          <UiEntity uiTransform={styles.rowCenterSpaceBetween}>
            <UiEntity
              uiTransform={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Label
                value={'<b>Cast speakers</b>'}
                fontSize={18}
                color={colors.white}
              />
              <UiEntity
                uiText={{
                  value: 'This link grants streaming access.',
                  fontSize: 14,
                  color: colors.gray,
                  textAlign: 'top-left',
                }}
              />
            </UiEntity>
            <FeedbackButton
              id="dcl_cast_copy_stream_link"
              value="<b>Copy Link</b>"
              variant="text"
              fontSize={18}
              color={colors.white}
              iconRight={ICONS.COPY_TO_CLIPBOARD_ICON}
              iconRightTransform={styles.iconSmall}
              labelTransform={styles.marginRightSmall}
              uiTransform={styles.copyLinkButton}
              onMouseDown={() => {
                state.videoControl.dclCast?.streamLink &&
                  copyToClipboard({
                    text: state.videoControl.dclCast.streamLink,
                  });
              }}
            />
          </UiEntity>
          <UiEntity uiTransform={styles.separatorLine} />
          <UiEntity uiTransform={styles.rowCenterSpaceBetween}>
            <UiEntity uiTransform={styles.textInfoContainer}>
              <Label
                value={'<b>Viewers</b>'}
                fontSize={18}
                color={colors.white}
              />
              <UiEntity
                uiText={{
                  value: 'This link grants viewing access.',
                  fontSize: 14,
                  color: colors.gray,
                  textAlign: 'top-left',
                }}
              />
            </UiEntity>
            <FeedbackButton
              id="dcl_cast_copy_watcher_link"
              value="<b>Copy Link</b>"
              variant="text"
              fontSize={18}
              color={colors.white}
              iconRight={ICONS.COPY_TO_CLIPBOARD_ICON}
              iconRightTransform={styles.iconSmall}
              labelTransform={styles.marginRightSmall}
              uiTransform={styles.copyLinkButton}
              onMouseDown={() => {
                state.videoControl.dclCast?.watcherLink &&
                  copyToClipboard({
                    text: state.videoControl.dclCast.watcherLink,
                  });
              }}
            />
          </UiEntity>
        </UiEntity>
      </UiEntity>
      <UiEntity uiTransform={styles.columnWithMarginTop}>
        <UiEntity uiTransform={styles.volumeShowcaseRow}>
          <VideoControlVolume
            engine={engine}
            entity={entity}
            video={video}
            label="<b>Cast controls</b>"
          />
          {video?.src && isDclCast(video.src) && (
            <Button
              id="dcl_cast_showcase_list"
              value="<b>Showcase List</b>"
              icon={ICONS.STAR}
              iconTransform={styles.starIcon}
              variant="secondary"
              fontSize={16}
              color={colors.white}
              uiTransform={styles.showcaseButton}
              onMouseDown={onShowShowcaseModal}
            />
          )}
        </UiEntity>
        <UiEntity uiTransform={styles.castControlsRow}>
          {video?.src && isDclCast(video.src) && video.src !== LIVEKIT_STREAM_SRC && (
            <Button
              id="dcl_cast_default_stream"
              value="<b>Default</b>"
              variant="secondary"
              fontSize={16}
              color={colors.white}
              uiTransform={styles.defaultButton}
              onMouseDown={() => {
                controls.setSource(LIVEKIT_STREAM_SRC);
                state.videoControl.selectedStream = 'dcl-cast';
              }}
            />
          )}
          <Button
            id="dcl_cast_reset_room_id"
            value="<b>Reset Room</b>"
            variant="text"
            fontSize={16}
            color={colors.danger}
            uiTransform={styles.resetButton}
            onMouseDown={onResetRoomId}
          />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  );
};

export default DclCastInfo;
