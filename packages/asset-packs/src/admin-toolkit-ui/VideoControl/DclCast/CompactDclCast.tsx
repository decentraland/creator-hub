import type { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { Color4 } from '@dcl/sdk/math';
import { getContentUrl } from '../../constants';
import { Button } from '../../Button';
import type { State } from '../../types';
import { LIVEKIT_STREAM_SRC } from '../LiveStream';
import {
  nextSlide,
  prevSlide,
  playPresentationVideo,
  pausePresentationVideo,
  stopPresentation,
} from '../api';
import { createVideoPlayerControls, isDclCast } from '../utils';
import { getCompactBarStyles, getDclCastBackgrounds, getDclCastColors } from './styles';

const ICONS = {
  get DCL_CAST_ICON() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/video-control-dcl-cast.png`;
  },
  get CHEVRON_DOWN() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/chevron-down.png`;
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

const CompactDclCast = ({
  engine,
  state,
  entity,
  video,
  onShowShowcaseModal,
}: {
  engine: IEngine;
  state: State;
  entity: Entity;
  video: DeepReadonlyObject<PBVideoPlayer> | undefined;
  onShowShowcaseModal: () => Promise<void>;
}) => {
  const styles = getCompactBarStyles();
  const colors = getDclCastColors();
  const backgrounds = getDclCastBackgrounds();
  const controls = createVideoPlayerControls(entity, engine);

  const isActive = !!(video?.src && isDclCast(video.src));
  const presentationState = state.videoControl.presentationState;
  const hasPresentation = isActive && !!presentationState;

  const handleExpand = () => {
    state.videoControl.isMinimized = false;
  };

  const handleActivate = () => {
    controls.setSource(LIVEKIT_STREAM_SRC);
    state.videoControl.selectedStream = 'dcl-cast';
  };

  const handlePrevSlide = () => prevSlide();
  const handleNextSlide = () => nextSlide();
  const handlePlayVideo = () => playPresentationVideo(0);
  const handlePauseVideo = () => pausePresentationVideo();
  const handleStopPresentation = () => stopPresentation();

  return (
    <UiEntity uiTransform={styles.outerContainer}>
      {/* Row 1: Icon + Title + (right side: Activate or Slide info + chevron) */}
      <UiEntity uiTransform={styles.container}>
        <UiEntity uiTransform={styles.leftSection}>
          <UiEntity
            uiTransform={styles.icon}
            uiBackground={{
              textureMode: 'stretch',
              texture: { src: ICONS.DCL_CAST_ICON },
            }}
          />
          <Label
            value={hasPresentation ? `<b>${presentationState.fileName}</b>` : '<b>DCL Cast</b>'}
            fontSize={24}
            color={colors.white}
          />
        </UiEntity>
        <UiEntity uiTransform={styles.rightSection}>
          {/* Activate button — visible when inactive */}
          <UiEntity uiTransform={{ display: isActive ? 'none' : 'flex' }}>
            <Button
              id="compact_dcl_cast_activate"
              value="<b>Activate</b>"
              labelTransform={styles.activateButtonLabel}
              uiTransform={styles.activateButton}
              fontSize={16}
              uiBackground={backgrounds.success}
              color={colors.black}
              onMouseDown={handleActivate}
            />
          </UiEntity>
          {/* Slide info — visible when presentation active */}
          <UiEntity uiTransform={{ display: hasPresentation ? 'flex' : 'none' }}>
            <Label
              value={
                presentationState
                  ? `Slide ${presentationState.currentSlide} / ${presentationState.slideCount}`
                  : ''
              }
              fontSize={16}
              color={colors.gray}
            />
          </UiEntity>
          <UiEntity
            onMouseDown={handleExpand}
            uiTransform={styles.chevronButton}
            uiBackground={{
              textureMode: 'stretch',
              color: Color4.White(),
              texture: {
                src: ICONS.CHEVRON_DOWN,
              },
            }}
          />
        </UiEntity>
      </UiEntity>

      {/* Row 2: Presentation controls — visible when presentation active */}
      <UiEntity
        uiTransform={{
          display: hasPresentation ? 'flex' : 'none',
          ...styles.presentationControlsRow,
        }}
      >
        <Button
          id="compact_dcl_cast_prev"
          value="<b>Prev</b>"
          icon={ICONS.PREV}
          iconTransform={styles.controlButtonIcon}
          fontSize={16}
          color={colors.black}
          uiTransform={styles.controlButton}
          onMouseDown={handlePrevSlide}
        />
        <Button
          id="compact_dcl_cast_next"
          value="<b>Next</b>"
          iconRight={ICONS.NEXT}
          iconRightTransform={styles.controlButtonIcon}
          fontSize={16}
          color={colors.black}
          uiTransform={styles.controlButton}
          onMouseDown={handleNextSlide}
        />
        <Button
          id="compact_dcl_cast_play"
          value="<b>Play Video</b>"
          icon={ICONS.PLAY}
          iconTransform={styles.controlButtonIcon}
          fontSize={16}
          color={colors.black}
          uiTransform={styles.controlButton}
          onMouseDown={handlePlayVideo}
        />
        <Button
          id="compact_dcl_cast_stop"
          onlyIcon
          icon={ICONS.STOP}
          iconTransform={styles.controlButtonIcon}
          uiTransform={styles.controlButton}
          onMouseDown={handlePauseVideo}
        />
      </UiEntity>

      {/* Row 3: Stop Sharing — visible when presentation active */}
      <UiEntity
        uiTransform={{
          display: hasPresentation ? 'flex' : 'none',
          ...styles.showcaseRow,
        }}
      >
        <Button
          id="compact_dcl_cast_stop_sharing"
          value="<b>Stop Sharing</b>"
          variant="text"
          fontSize={16}
          color={colors.danger}
          uiTransform={styles.showcaseButton}
          onMouseDown={handleStopPresentation}
        />
      </UiEntity>

      {/* Row 3 (alt): Showcase List — visible when active WITHOUT presentation */}
      <UiEntity
        uiTransform={{
          display: isActive && !hasPresentation ? 'flex' : 'none',
          ...styles.showcaseRow,
        }}
      >
        <Button
          id="compact_dcl_cast_showcase"
          value="<b>Showcase List</b>"
          icon={ICONS.STAR}
          iconTransform={styles.starIcon}
          variant="secondary"
          fontSize={16}
          color={colors.white}
          uiTransform={styles.showcaseButton}
          onMouseDown={onShowShowcaseModal}
        />
      </UiEntity>
    </UiEntity>
  );
};

export default CompactDclCast;
