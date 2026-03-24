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
import { LIVEKIT_STREAM_SRC } from '../LiveStream';
import {
  nextSlide,
  prevSlide,
  playPresentationVideo,
  pausePresentationVideo,
  stopPresentation,
  isPresentationBot,
} from '../api';
import { VideoControlVolume } from '../VolumeControl';
import { createVideoPlayerControls, isDclCast } from '../utils';
import { showcaseState } from '.';
import { getDclCastStyles, getDclCastColors, getDclCastBackgrounds } from './styles';

const ICONS = {
  get COPY_TO_CLIPBOARD_ICON() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/copy-to-clipboard.png`;
  },
  get STAR() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/star.png`;
  },
  get PREV() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/arrow-back.png`;
  },
  get NEXT() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/arrow-forward.png`;
  },
  get STOP() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/stop.png`;
  },
  get PLAY() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/video-control-play-button.png`;
  },
};

const DclCastInfo = ({
  state,
  engine,
  onResetRoomId,
  onShowShowcaseModal,
  entity,
  video,
}: {
  state: State;
  engine: IEngine;
  onResetRoomId: () => Promise<void>;
  onShowShowcaseModal: () => Promise<void>;
  entity: Entity;
  video: DeepReadonlyObject<PBVideoPlayer> | undefined;
}) => {
  const controls = createVideoPlayerControls(entity, engine);
  const styles = getDclCastStyles();
  const colors = getDclCastColors();
  const backgrounds = getDclCastBackgrounds();
  const presentationState = state.videoControl.presentationState;
  const isCastActive = !!(video?.src && isDclCast(video.src));
  const presentationBotInRoom = showcaseState.participants.some(p => isPresentationBot(p.name));
  const hasPresentation = isCastActive && (!!presentationState || presentationBotInRoom);

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
        {/* Presentation info — visible when presentation track detected */}
        <UiEntity
          uiTransform={{
            display: hasPresentation ? 'flex' : 'none',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            margin: { top: 8, bottom: 4 },
          }}
        >
          <Label
            value={`<b>${presentationState?.fileName ?? ''}</b>`}
            fontSize={16}
            color={colors.white}
          />
          <Label
            value={
              presentationState
                ? `Slide ${presentationState.currentSlide} / ${presentationState.slideCount}`
                : ''
            }
            fontSize={14}
            color={colors.gray}
          />
        </UiEntity>
        {/* Presentation controls — visible when presentation track detected */}
        <UiEntity
          uiTransform={{
            display: hasPresentation ? 'flex' : 'none',
            flexDirection: 'column',
            width: '100%',
          }}
        >
          <UiEntity uiTransform={styles.presentationControlsRow}>
            <Button
              id="dcl_cast_prev"
              value="<b>Prev</b>"
              icon={ICONS.PREV}
              iconTransform={styles.controlButtonIcon}
              fontSize={16}
              color={colors.black}
              uiTransform={styles.controlButton}
              onMouseDown={() => prevSlide()}
            />
            <Button
              id="dcl_cast_next"
              value="<b>Next</b>"
              iconRight={ICONS.NEXT}
              iconRightTransform={styles.controlButtonIcon}
              fontSize={16}
              color={colors.black}
              uiTransform={styles.controlButton}
              onMouseDown={() => nextSlide()}
            />
            <Button
              id="dcl_cast_play"
              value="<b>Play Video</b>"
              icon={ICONS.PLAY}
              iconTransform={styles.controlButtonIcon}
              fontSize={16}
              color={colors.black}
              uiTransform={styles.controlButton}
              onMouseDown={() => playPresentationVideo(0)}
            />
            <Button
              id="dcl_cast_stop"
              onlyIcon
              icon={ICONS.STOP}
              iconTransform={styles.controlButtonIcon}
              uiTransform={styles.controlButton}
              onMouseDown={() => pausePresentationVideo()}
            />
          </UiEntity>
          <Button
            id="dcl_cast_stop_sharing"
            value="<b>Stop Sharing</b>"
            variant="text"
            fontSize={16}
            color={colors.danger}
            uiTransform={styles.resetButton}
            onMouseDown={() => stopPresentation()}
          />
        </UiEntity>
        <UiEntity uiTransform={styles.castControlsRow}>
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
