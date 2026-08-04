import { type IEngine } from '@dcl/ecs';
import ReactEcs, { UiEntity, Dropdown } from '@dcl/react-ecs';
import { type State } from '../types';
import type { AdminTools } from '../../definitions';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';
import { SectionHeader, FieldLabel, ActivePill, Divider } from '../Primitives';
import { Segmented } from '../Controls';
import { selectVideoSubTab, selectVideoPlayer } from '../actions';
import { getVideoPlayers, isVideoUrl, useSelectedVideoPlayer } from './utils';
import { VideoControlURL } from './VideoUrl';
import { LiveStream } from './LiveStream';
import DclCast from './DclCast';

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
  const selected = state.videoControl.selectedTab;

  ReactEcs.useEffect(() => {
    // An explicit DCL Cast context (auto-open on a presentation, or an active cast
    // stream) wins over src-derivation, so the panel lands on DCL Cast even when no
    // scene screen is casting yet. Otherwise reflect the selected screen's source.
    if (state.videoControl.selectedStream === 'dcl-cast') {
      selectVideoSubTab('dcl-cast');
      return;
    }
    selectVideoSubTab(selectedVideo && isVideoUrl(selectedVideo.src) ? 'video-url' : 'live');
  }, [state.videoControl.selectedVideoPlayer, state.videoControl.selectedStream]);

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
              onChange={idx => selectVideoPlayer(idx)}
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
            onSelect={selectVideoSubTab}
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
