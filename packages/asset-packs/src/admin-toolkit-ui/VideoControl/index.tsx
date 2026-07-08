import { type IEngine } from '@dcl/ecs';
import ReactEcs, { UiEntity, Dropdown } from '@dcl/react-ecs';
import { getContentUrl } from '../constants';
import { type State } from '../types';
import type { AdminTools } from '../../definitions';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { SectionHeader, FieldLabel, ActivePill, Divider } from '../Primitives';
import { Segmented } from '../Controls';
import { getVideoPlayers, isDclCast, isVideoUrl, useSelectedVideoPlayer } from './utils';
import { VideoControlURL } from './VideoUrl';
import { LiveStream } from './LiveStream';
import DclCast from './DclCast';

// Legacy icon getters kept for sub-components that still reference them.
export const ICONS = {
  get VIDEO_CONTROL() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/video-control.png`;
  },
  get PREVIOUS_BUTTON() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/video-control-previous-button.png`;
  },
  get FORWARD_BUTTON() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/video-control-forward-button.png`;
  },
  get PLAY_BUTTON() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/video-control-play-button.png`;
  },
  get MUTE() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/video-control-mute.png`;
  },
  get LOOP() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/video-control-loop.png`;
  },
  get VOLUME_MINUS_BUTTON() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/video-control-volume-minus-button.png`;
  },
  get VOLUME_PLUS_BUTTON() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/video-control-volume-plus-button.png`;
  },
  get VIDEO_SOURCE() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/video-control-video-icon.png`;
  },
  get LIVE_SOURCE() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/video-control-live.png`;
  },
  get DCL_CAST_SOURCE() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/video-control-dcl-cast.png`;
  },
  get INFO() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/info.png`;
  },
};

export const VOLUME_STEP = 0.1;
export const DEFAULT_VOLUME = 1;

type MediaSource = 'video-url' | 'dcl-cast' | 'live';

const SECTION_PADDING = {
  left: SPACING.xxl,
  right: SPACING.xxl,
  top: SPACING.xl,
  bottom: SPACING.xl,
};

export function VideoControl({
  engine,
  state,
  playerAddress,
}: {
  engine: IEngine;
  state: State;
  playerAddress: string | undefined;
}) {
  const [selectedEntity, selectedVideo] = useSelectedVideoPlayer(engine) ?? [];
  const videoPlayers = getVideoPlayers(engine);
  const [selected, setSelected] = ReactEcs.useState<MediaSource | undefined>(undefined);

  ReactEcs.useEffect(() => {
    setSelected(
      selectedVideo && isDclCast(selectedVideo.src)
        ? 'dcl-cast'
        : selectedVideo && isVideoUrl(selectedVideo.src)
          ? 'video-url'
          : 'live',
    );
  }, [state.videoControl.selectedVideoPlayer]);

  const isActive = !!(selectedVideo?.src && selectedVideo.src.length > 0);

  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
      <UiEntity uiTransform={{ flexDirection: 'column', width: '100%', padding: SECTION_PADDING }}>
        <SectionHeader
          title="Video screens"
          right={isActive && <ActivePill />}
        />

        {videoPlayers.length > 1 && (
          <UiEntity
            uiTransform={{ flexDirection: 'column', width: '100%', margin: { top: SPACING.xl } }}
          >
            <FieldLabel text="Screen" />
            <Dropdown
              options={videoPlayers.map(
                (player: NonNullable<AdminTools['videoControl']['videoPlayers']>[0]) =>
                  player.customName,
              )}
              selectedIndex={state.videoControl.selectedVideoPlayer ?? 0}
              onChange={idx => (state.videoControl.selectedVideoPlayer = idx)}
              textAlign="middle-left"
              fontSize={TYPE.body}
              color={COLORS.inputText}
              uiTransform={{
                width: '100%',
                height: 40,
                borderRadius: RADIUS.md,
                borderWidth: 1,
                borderColor: COLORS.inputBorder,
              }}
              uiBackground={{ color: COLORS.inputBackground }}
            />
          </UiEntity>
        )}

        <UiEntity
          uiTransform={{ flexDirection: 'column', width: '100%', margin: { top: SPACING.xl } }}
        >
          <FieldLabel text="Media source" />
          <Segmented<MediaSource>
            options={[
              { key: 'video-url', label: 'URL', icon: 'play' },
              { key: 'dcl-cast', label: 'DCL Cast', icon: 'tv' },
              { key: 'live', label: 'Stream', icon: 'broadcast' },
            ]}
            selected={selected}
            onSelect={setSelected}
          />
        </UiEntity>
      </UiEntity>

      {selected && selectedEntity && (
        <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
          <Divider />
          <UiEntity
            uiTransform={{ flexDirection: 'column', width: '100%', padding: SECTION_PADDING }}
          >
            {selected === 'video-url' && (
              <VideoControlURL
                engine={engine}
                entity={selectedEntity}
                video={selectedVideo}
              />
            )}
            {selected === 'live' && (
              <LiveStream
                engine={engine}
                entity={selectedEntity}
                video={selectedVideo}
              />
            )}
            {selected === 'dcl-cast' && (
              <DclCast
                engine={engine}
                state={state}
                entity={selectedEntity}
                video={selectedVideo}
                playerAddress={playerAddress}
              />
            )}
          </UiEntity>
        </UiEntity>
      )}
    </UiEntity>
  );
}
