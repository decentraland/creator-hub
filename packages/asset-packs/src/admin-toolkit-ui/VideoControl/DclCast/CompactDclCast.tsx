import type { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { Color4 } from '@dcl/sdk/math';
import { getContentUrl } from '../../constants';
import { Button } from '../../Button';
import type { State } from '../../types';
import { LIVEKIT_STREAM_SRC } from '../LiveStream';
import { isPresentationBot } from '../api';
import { createVideoPlayerControls, isDclCast } from '../utils';
import { showcaseState } from '.';
import PresentationPanel from './PresentationPanel';
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
  const presentationBotInRoom = showcaseState.participants.some(p => isPresentationBot(p.name));
  const hasPresentation = isActive && (!!presentationState || presentationBotInRoom);

  const handleExpand = () => {
    state.videoControl.isMinimized = false;
  };

  const handleActivate = () => {
    controls.setSource(LIVEKIT_STREAM_SRC);
    state.videoControl.selectedStream = 'dcl-cast';
  };

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
            value={'<b>DCL Cast</b>'}
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
          <UiEntity uiTransform={{ display: hasPresentation ? 'flex' : 'none', height: 24 }}>
            <Label
              value={
                presentationState
                  ? `Slide ${presentationState.currentSlide + 1} / ${presentationState.slideCount}`
                  : ''
              }
              fontSize={16}
              color={colors.gray}
              uiTransform={{ height: 24, minWidth: 120 }}
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
          width: '100%',
          margin: { top: 16 },
        }}
      >
        <PresentationPanel
          presentationState={presentationState}
          compact
          idPrefix="compact_dcl_cast"
          onStopSharing={() => {
            state.videoControl.presentationState = undefined;
          }}
        />
      </UiEntity>

      {/* Row 3: Speakers — visible when active (with or without presentation) */}
      <UiEntity
        uiTransform={{
          display: isActive ? 'flex' : 'none',
          ...styles.showcaseRow,
        }}
      >
        <Button
          id="compact_dcl_cast_showcase"
          value="<b>Speakers</b>"
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
