import { type IEngine } from '@dcl/ecs';
import ReactEcs, { Label, UiEntity, Dropdown } from '@dcl/react-ecs';
import { Color4 } from '@dcl/sdk/math';
import { Button } from '../Button';
import { CONTENT_URL } from '../constants';
import { type State } from '../types';
import type { AdminTools } from '../../definitions';
import { Header } from '../Header';
import { Active } from '../Active';
import { Card } from '../Card';
import {
  getVideoPlayers,
  isDclCast,
  isLiveStream,
  isVideoUrl,
  useSelectedVideoPlayer,
} from './utils';
import { VideoControlURL } from './VideoUrl';
import { LiveStream } from './LiveStream';
import DclCast from './DclCast';

// Constants
export const ICONS = {
  VIDEO_CONTROL: `${CONTENT_URL}/admin_toolkit/assets/icons/video-control.png`,
  PREVIOUS_BUTTON: `${CONTENT_URL}/admin_toolkit/assets/icons/video-control-previous-button.png`,
  FORWARD_BUTTON: `${CONTENT_URL}/admin_toolkit/assets/icons/video-control-forward-button.png`,
  PLAY_BUTTON: `${CONTENT_URL}/admin_toolkit/assets/icons/video-control-play-button.png`,
  MUTE: `${CONTENT_URL}/admin_toolkit/assets/icons/video-control-mute.png`,
  LOOP: `${CONTENT_URL}/admin_toolkit/assets/icons/video-control-loop.png`,
  VOLUME_MINUS_BUTTON: `${CONTENT_URL}/admin_toolkit/assets/icons/video-control-volume-minus-button.png`,
  VOLUME_PLUS_BUTTON: `${CONTENT_URL}/admin_toolkit/assets/icons/video-control-volume-plus-button.png`,
  VIDEO_SOURCE: `${CONTENT_URL}/admin_toolkit/assets/icons/video-control-video-icon.png`,
  LIVE_SOURCE: `${CONTENT_URL}/admin_toolkit/assets/icons/video-control-live.png`,
  DCL_CAST_SOURCE: `${CONTENT_URL}/admin_toolkit/assets/icons/video-control-dcl-cast.png`,
  INFO: `${CONTENT_URL}/admin_toolkit/assets/icons/info.png`,
} as const;

export const VOLUME_STEP = 0.1;
export const DEFAULT_VOLUME = 1;

export const COLORS = {
  WHITE: Color4.White(),
  GRAY: Color4.create(160 / 255, 155 / 255, 168 / 255, 1),
  SUCCESS: Color4.fromHexString('#34CE77'),
} as const;

// Main component
export function VideoControl({ engine, state }: { engine: IEngine; state: State }) {
  const [selectedEntity, selectedVideo] = useSelectedVideoPlayer(engine) ?? [];
  const videoPlayers = getVideoPlayers(engine);
  const [selected, setSelected] = ReactEcs.useState<'video-url' | 'live' | 'dcl-cast' | undefined>(
    undefined,
  );

  ReactEcs.useEffect(() => {
    setSelected(
      selectedVideo && isDclCast(selectedVideo.src)
        ? 'dcl-cast'
        : selectedVideo && isVideoUrl(selectedVideo.src)
          ? 'video-url'
          : 'live',
    );
  }, [state.videoControl.selectedVideoPlayer]);

  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%', height: '100%' }}>
      <Card
        uiTransform={{
          padding: {
            top: 32,
            right: 32,
            bottom: 0,
            left: 32,
          },
        }}
      >
        <UiEntity
          uiTransform={{
            width: '100%',
            height: '100%',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <Header
            iconSrc={ICONS.VIDEO_CONTROL}
            title="<b>VIDEO SCREENS</b>"
          />
          {videoPlayers.length > 1 && (
            <Label
              value="<b>Current Screen</b>"
              fontSize={16}
              color={Color4.White()}
              uiTransform={{ margin: { bottom: 16 } }}
            />
          )}

          <UiEntity
            uiTransform={{
              flexDirection: 'column',
              margin: { bottom: 16 },
            }}
          >
            {videoPlayers.length > 1 && (
              <UiEntity uiTransform={{ flexDirection: 'column' }}>
                <Dropdown
                  options={videoPlayers.map(
                    (player: NonNullable<AdminTools['videoControl']['videoPlayers']>[0]) =>
                      `<b>${player.customName}</b>`,
                  )}
                  selectedIndex={state.videoControl.selectedVideoPlayer ?? 0}
                  onChange={idx => (state.videoControl.selectedVideoPlayer = idx)}
                  textAlign="middle-left"
                  fontSize={16}
                  uiTransform={{
                    margin: { right: 8 },
                    width: '100%',
                  }}
                  uiBackground={{ color: Color4.White() }}
                />
              </UiEntity>
            )}
            <Label
              fontSize={16}
              value="<b>Media Source</b>"
              color={Color4.White()}
              uiTransform={{
                margin: { bottom: 2, top: 16 },
              }}
            />
            <UiEntity
              uiTransform={{
                margin: { top: 10 },
                flexDirection: 'row',
                width: '100%',
                justifyContent: 'space-between',
              }}
            >
              <UiEntity
                uiTransform={{
                  width: '30%',
                }}
              >
                <CustomButton
                  engine={engine}
                  id="video_control_url"
                  value="<b>VIDEO URL</b>"
                  icon={ICONS.VIDEO_SOURCE}
                  onClick={() => setSelected('video-url')}
                  selected={selected === 'video-url'}
                  active={selectedVideo && isVideoUrl(selectedVideo.src)}
                />
              </UiEntity>
              <UiEntity
                uiTransform={{
                  width: '30%',
                }}
              >
                <CustomButton
                  engine={engine}
                  id="video_control_dcl_cast"
                  value="<b>DCL CAST</b>"
                  icon={ICONS.DCL_CAST_SOURCE}
                  onClick={() => setSelected('dcl-cast')}
                  selected={selected === 'dcl-cast'}
                  active={selectedVideo && isDclCast(selectedVideo.src)}
                />
              </UiEntity>
              <UiEntity
                uiTransform={{
                  width: '30%',
                }}
              >
                <CustomButton
                  engine={engine}
                  id="video_control_live"
                  value="<b>STREAM</b>"
                  icon={ICONS.LIVE_SOURCE}
                  onClick={() => setSelected('live')}
                  active={selectedVideo && isLiveStream(selectedVideo.src)}
                  selected={selected === 'live'}
                />
              </UiEntity>
            </UiEntity>
          </UiEntity>
        </UiEntity>
      </Card>
      {selected && selectedEntity && (
        <Card>
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
            />
          )}
        </Card>
      )}
    </UiEntity>
  );
}

interface Props {
  id: string;
  value: string;
  onClick(): void;
  selected: boolean;
  icon: string;
  engine: IEngine;
  active?: boolean;
}

function CustomButton({ active, value, id, onClick, icon, selected, engine }: Props) {
  return (
    <UiEntity uiTransform={{ flexDirection: 'column', height: '100%', width: '100%' }}>
      <UiEntity uiTransform={{ width: '100%' }}>
        <Button
          id={id}
          onMouseDown={onClick}
          value={value}
          fontSize={14}
          icon={icon}
          iconTransform={{
            width: 24,
            height: 24,
            margin: { right: 8 },
          }}
          color={selected ? Color4.Black() : Color4.fromHexString('#FCFCFC')}
          iconBackground={{
            color: selected ? Color4.Black() : Color4.fromHexString('#FCFCFC'),
          }}
          uiBackground={{
            color: selected ? Color4.White() : Color4.fromHexString('#43404A'),
          }}
          uiTransform={{
            padding: {
              top: 6,
              bottom: 6,
            },
            borderRadius: 6,
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: 36,
          }}
        />
      </UiEntity>

      {active && (
        <Active
          engine={engine}
          uiTransform={{ width: '100%', margin: { top: 6 } }}
        />
      )}
    </UiEntity>
  );
}
