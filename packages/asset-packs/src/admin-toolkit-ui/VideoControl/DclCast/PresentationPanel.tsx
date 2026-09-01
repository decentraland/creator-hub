// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ReactEcs is the JSX factory
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { Button } from '../../Button';
import type { PresentationState } from '../../types';
import { COLORS, RADIUS, SPACING, TYPE } from '../../theme';
import { icon } from '../../icons';
import {
  nextSlide,
  prevSlide,
  playPresentationVideo,
  pausePresentationVideo,
  stopPresentation,
} from '../api';

const PresentationPanel = ({
  presentationState,
  idPrefix = 'presentation_panel',
  onStopSharing,
}: {
  presentationState: PresentationState | undefined;
  idPrefix?: string;
  onStopSharing?: () => void;
}) => {
  const isVideoPlaying =
    presentationState?.videoState === 'playing' || presentationState?.videoState === 'loading';
  const hasSlideVideo = (presentationState?.slideVideos?.length ?? 0) > 0;

  const ctrl = {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: { left: 4, right: 4 },
    margin: { right: SPACING.md },
  };
  const iconTf = { width: 15, height: 15 };

  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
      <UiEntity
        uiTransform={{
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: { bottom: SPACING.md },
        }}
      >
        <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
          <UiEntity
            uiTransform={{ width: 6, height: 6, borderRadius: 3, margin: { right: 5 } }}
            uiBackground={{ color: COLORS.success }}
          />
          <Label
            value="Presenting"
            fontSize={TYPE.label}
            color={COLORS.success}
          />
        </UiEntity>
        <Label
          value={`Slide ${(presentationState?.currentSlide ?? 0) + 1} of ${
            presentationState?.slideCount ?? 0
          }`}
          fontSize={TYPE.label}
          color={COLORS.textSecondary}
        />
      </UiEntity>

      <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
        <Button
          id={`${idPrefix}_prev`}
          value="Prev"
          variant="secondary"
          fontSize={TYPE.body}
          color={COLORS.textTertiary}
          icon={icon('arrowL')}
          iconTransform={{ ...iconTf, margin: { right: 5 } }}
          iconBackground={{ color: COLORS.textTertiary }}
          uiTransform={ctrl}
          onMouseDown={() => prevSlide()}
        />
        <Button
          id={`${idPrefix}_next`}
          value="Next"
          variant="secondary"
          fontSize={TYPE.body}
          color={COLORS.textTertiary}
          iconRight={icon('arrowR')}
          iconRightTransform={{ ...iconTf, margin: { left: 5 } }}
          iconRightBackground={{ color: COLORS.textTertiary }}
          uiTransform={ctrl}
          onMouseDown={() => nextSlide()}
        />
        <Button
          id={`${idPrefix}_play`}
          value={isVideoPlaying ? 'Pause video' : 'Play video'}
          variant="secondary"
          fontSize={TYPE.body}
          color={COLORS.textTertiary}
          disabled={!hasSlideVideo}
          icon={isVideoPlaying ? icon('pause') : icon('play')}
          iconTransform={{ ...iconTf, margin: { right: 5 } }}
          iconBackground={{ color: COLORS.textTertiary }}
          uiTransform={ctrl}
          onMouseDown={() => (isVideoPlaying ? pausePresentationVideo() : playPresentationVideo(0))}
        />
        <Button
          id={`${idPrefix}_stop`}
          onlyIcon
          variant="primary"
          icon={icon('stop')}
          iconTransform={iconTf}
          iconBackground={{ color: COLORS.white }}
          uiTransform={{
            width: 36,
            height: 34,
            borderRadius: RADIUS.md,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseDown={() => {
            stopPresentation();
            onStopSharing?.();
          }}
        />
      </UiEntity>
    </UiEntity>
  );
};

export default PresentationPanel;
