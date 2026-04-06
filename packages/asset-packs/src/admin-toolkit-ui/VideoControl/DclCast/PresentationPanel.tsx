// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ReactEcs is required for JSX factory
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { getContentUrl } from '../../constants';
import { Button } from '../../Button';
import type { PresentationState } from '../../types';
import {
  nextSlide,
  prevSlide,
  playPresentationVideo,
  pausePresentationVideo,
  stopPresentation,
} from '../api';
import { getDclCastStyles, getDclCastColors } from './styles';

const ICONS = {
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

const MAX_TITLE_LENGTH = 30;

function trimTitle(title: string, maxLength: number = MAX_TITLE_LENGTH): string {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
}

const PresentationPanel = ({
  presentationState,
  compact,
  idPrefix = 'presentation_panel',
  onStopSharing,
}: {
  presentationState: PresentationState | undefined;
  compact?: boolean;
  idPrefix?: string;
  onStopSharing?: () => void;
}) => {
  const styles = getDclCastStyles();
  const colors = getDclCastColors();

  return (
    <UiEntity
      uiTransform={{
        flexDirection: 'column',
        width: '100%',
      }}
    >
      {!compact && (
        <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
          {/* Title row: fileName + Slide X / Y */}
          <UiEntity
            uiTransform={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              height: 30,
            }}
          >
            <Label
              value={`<b>${trimTitle(presentationState?.fileName ?? '', 15)}</b>`}
              fontSize={24}
              color={colors.white}
              textAlign="middle-left"
              uiTransform={{ height: 30 }}
            />
            <Label
              value={
                presentationState
                  ? `Slide ${presentationState.currentSlide + 1} / ${presentationState.slideCount}`
                  : ''
              }
              fontSize={16}
              textAlign="middle-right"
              color={colors.gray}
              uiTransform={{ height: 30, minWidth: 144 }}
            />
          </UiEntity>

          {/* "Presentation controls" label */}
          <Label
            value="Presentation controls"
            fontSize={14}
            color={colors.white}
            uiTransform={{ height: 20, margin: { top: 16 } }}
          />
        </UiEntity>
      )}

      {/* Control buttons row */}
      <UiEntity
        uiTransform={{
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
          margin: { top: compact ? 0 : 16 },
        }}
      >
        <Button
          id={`${idPrefix}_prev`}
          value="<b>Prev</b>"
          icon={ICONS.PREV}
          iconTransform={styles.controlButtonIcon}
          fontSize={16}
          color={colors.black}
          uiTransform={{ ...styles.controlButton, margin: { right: 8 } }}
          onMouseDown={() => prevSlide()}
        />
        <Button
          id={`${idPrefix}_next`}
          value="<b>Next</b>"
          iconRight={ICONS.NEXT}
          iconRightTransform={styles.controlButtonIcon}
          fontSize={16}
          color={colors.black}
          uiTransform={{ ...styles.controlButton, margin: { right: 8 } }}
          onMouseDown={() => nextSlide()}
        />
        <Button
          id={`${idPrefix}_play`}
          value="<b>Play Video</b>"
          icon={ICONS.PLAY}
          iconTransform={styles.controlButtonIcon}
          fontSize={16}
          color={colors.black}
          uiTransform={{ ...styles.controlButton, margin: { right: 8 } }}
          onMouseDown={() => playPresentationVideo(0)}
        />
        <Button
          id={`${idPrefix}_stop`}
          value="Stop"
          fontSize={16}
          onlyIcon={true}
          icon={ICONS.STOP}
          iconTransform={styles.controlButtonIcon}
          uiTransform={styles.controlButton}
          onMouseDown={() => pausePresentationVideo()}
        />
      </UiEntity>

      <Button
        id={`${idPrefix}_stop_sharing`}
        value="<b>Stop Sharing</b>"
        variant="text"
        fontSize={16}
        color={colors.danger}
        uiTransform={{ ...styles.resetButton, margin: { top: 16 } }}
        onMouseDown={() => {
          stopPresentation();
          onStopSharing?.();
        }}
      />
    </UiEntity>
  );
};

export default PresentationPanel;
