import type { DeepReadonlyObject, IEngine, PBVideoPlayer, Entity } from '@dcl/ecs';
import ReactEcs, { UiEntity, Input } from '@dcl/react-ecs';
import { openExternalUrl } from '~system/RestrictedActions';
import { LIVEKIT_STREAM_SRC } from '../../definitions';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { SectionHeader, FieldLabel, Icon } from '../Primitives';
import { PillButton, Slider } from '../Controls';
import { createVideoPlayerControls, isVideoUrl } from './utils';

const VIDEO_PLAYER_HELP_URL =
  'https://docs.decentraland.org/creator/scene-editor/interactivity/video-screen';

export function VideoControlURL({
  engine,
  video,
  entity,
}: {
  engine: IEngine;
  entity: Entity;
  video: DeepReadonlyObject<PBVideoPlayer> | undefined;
}) {
  const [videoURL, setVideoURL] = ReactEcs.useState('');
  ReactEcs.useEffect(() => {
    const url = video?.src?.startsWith('livekit-video://') ? '' : video?.src;
    setVideoURL(url ?? '');
  }, [entity]);
  const controls = createVideoPlayerControls(entity, engine);
  const isActive = !!(video && isVideoUrl(video.src));
  const volume = video?.volume ?? 1;
  const changed = !!(video?.src && videoURL !== video.src && video.src !== LIVEKIT_STREAM_SRC);
  const primaryLabel = isActive && !changed ? 'Deactivate' : changed ? 'Update' : 'Activate';

  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
      <SectionHeader
        title="Video URL"
        right={
          <UiEntity
            uiTransform={{ width: 16, height: 16 }}
            uiBackground={{ color: COLORS.transparent }}
            onMouseDown={() => openExternalUrl({ url: VIDEO_PLAYER_HELP_URL })}
          >
            <Icon
              name="help"
              size={16}
              color={COLORS.textSecondary}
            />
          </UiEntity>
        }
      />
      <UiEntity
        uiTransform={{ width: '100%', height: 20, margin: { top: SPACING.lg, bottom: SPACING.xl } }}
        uiText={{
          value: 'Paste an .m3u8 video URL to play it on this screen.',
          fontSize: TYPE.label,
          color: COLORS.textSecondary,
          textAlign: 'top-left',
          textWrap: 'wrap',
        }}
      />

      {/* URL input + activate */}
      <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
        <Input
          onChange={setVideoURL}
          value={videoURL}
          fontSize={TYPE.body}
          textAlign="middle-left"
          placeholder="Paste your video URL"
          placeholderColor={COLORS.inputPlaceholder}
          color={COLORS.inputText}
          uiBackground={{ color: COLORS.inputBackground }}
          uiTransform={{
            flexGrow: 1,
            flexBasis: 0,
            minWidth: 0,
            height: 40,
            borderRadius: RADIUS.md,
            borderWidth: 1,
            borderColor: COLORS.inputBorder,
            margin: { right: SPACING.md },
          }}
        />
        <PillButton
          id="video_control_share_screen_share"
          label={primaryLabel}
          variant="filled"
          disabled={primaryLabel !== 'Deactivate' && !isVideoUrl(videoURL)}
          uiTransform={{ flexShrink: 0 }}
          onClick={() => controls.setSource(primaryLabel === 'Deactivate' ? '' : videoURL)}
        />
      </UiEntity>

      {/* Playback */}
      <UiEntity
        uiTransform={{ flexDirection: 'column', width: '100%', margin: { top: SPACING.xl } }}
      >
        <FieldLabel text="Playback" />
        <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
          <PillButton
            id="video_control_play"
            label="Play"
            iconName="play"
            variant="outlined"
            uiTransform={{
              flexGrow: 1,
              flexBasis: 0,
              height: 34,
              padding: { left: 4, right: 4 },
              margin: { right: SPACING.md },
            }}
            onClick={() => controls.play()}
          />
          <PillButton
            id="video_control_pause"
            label="Pause"
            iconName="pause"
            variant="outlined"
            uiTransform={{
              flexGrow: 1,
              flexBasis: 0,
              height: 34,
              padding: { left: 4, right: 4 },
              margin: { right: SPACING.md },
            }}
            onClick={() => controls.pause()}
          />
          <PillButton
            id="video_control_restart"
            label="Restart"
            iconName="refresh"
            variant="outlined"
            uiTransform={{
              flexGrow: 1,
              flexBasis: 0,
              height: 34,
              padding: { left: 4, right: 4 },
              margin: { right: SPACING.md },
            }}
            onClick={() => controls.restart()}
          />
          <UiEntity
            uiTransform={{
              width: 36,
              height: 34,
              borderRadius: RADIUS.md,
              borderWidth: 1,
              borderColor: COLORS.outline,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            uiBackground={{ color: video?.loop ? COLORS.primary : COLORS.transparent }}
            onMouseDown={() => controls.setLoop(!video?.loop)}
          >
            <Icon
              name="loop"
              size={15}
              color={video?.loop ? COLORS.white : COLORS.textTertiary}
            />
          </UiEntity>
        </UiEntity>
      </UiEntity>

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
          <UiEntity
            uiTransform={{ margin: { left: SPACING.lg } }}
            uiText={{
              value: `${Math.round(volume * 100)}%`,
              fontSize: TYPE.body,
              color: COLORS.textPrimary,
            }}
          />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  );
}
