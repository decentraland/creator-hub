import { IEngine } from '@dcl/ecs';
import ReactEcs, { Label, UiEntity, Dropdown } from '@dcl/react-ecs';
import { Color4 } from '@dcl/sdk/math';
import { getScaleUIFactor } from '../../ui';
import { Button } from '../Button';
import { CONTENT_URL } from '../constants';
import { State } from '../types';
import { Header } from '../Header';
import { getVideoPlayers, useSelectedVideoPlayer } from './utils';
import { Card } from '../Card';
import { VideoControlURL } from './VideoUrl';
import { LiveStream } from './LiveStream';
import { Active } from '../Active';
import { LIVEKIT_STREAM_SRC } from '../../definitions';

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
  VIDEO_SOURCE: `${CONTENT_URL}/admin_toolkit/assets/icons/video-control-video.png`,
  LIVE_SOURCE: `${CONTENT_URL}/admin_toolkit/assets/icons/video-control-live.png`,
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
  const scaleFactor = getScaleUIFactor(engine);
  const videoPlayers = getVideoPlayers(engine);
  const [selected, setSelected] = ReactEcs.useState<'video-url' | 'live' | undefined>(undefined);

  ReactEcs.useEffect(() => {
    setSelected(selectedVideo && selectedVideo.src.startsWith('https://') ? 'video-url' : 'live');
  }, [state.videoControl.selectedVideoPlayer]);

  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%', height: '100%' }}>
      <Card
        scaleFactor={scaleFactor}
        uiTransform={{
          padding: {
            top: 32 * scaleFactor,
            right: 32 * scaleFactor,
            bottom: 0,
            left: 32 * scaleFactor,
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
            scaleFactor={scaleFactor}
          />
          {videoPlayers.length > 1 && (
            <Label
              value="<b>Current Screen</b>"
              fontSize={16 * scaleFactor}
              color={Color4.White()}
              uiTransform={{ margin: { bottom: 16 * scaleFactor } }}
            />
          )}

          <UiEntity
            uiTransform={{
              flexDirection: 'column',
              margin: { bottom: 16 * scaleFactor },
            }}
          >
            {videoPlayers.length > 1 && (
              <UiEntity uiTransform={{ flexDirection: 'column' }}>
                <Dropdown
                  options={videoPlayers.map(player => `<b>${player.customName}</b>`)}
                  selectedIndex={state.videoControl.selectedVideoPlayer ?? 0}
                  onChange={idx => (state.videoControl.selectedVideoPlayer = idx)}
                  textAlign="middle-left"
                  fontSize={16 * scaleFactor}
                  uiTransform={{
                    margin: { right: 8 * scaleFactor },
                    width: '100%',
                  }}
                  uiBackground={{ color: Color4.White() }}
                />
              </UiEntity>
            )}
            <Label
              fontSize={16 * scaleFactor}
              value="<b>Media Source</b>"
              color={Color4.White()}
              uiTransform={{ margin: { bottom: 2 * scaleFactor, top: 16 * scaleFactor } }}
            />
            <UiEntity
              uiTransform={{
                margin: { top: 10 * scaleFactor },
                flexDirection: 'row',
                width: '100%',
              }}
            >
              <UiEntity uiTransform={{ width: '50%', padding: { right: 8 * scaleFactor } }}>
                <CustomButton
                  engine={engine}
                  id="video_control_url"
                  value="<b>VIDEO URL</b>"
                  icon={ICONS.VIDEO_SOURCE}
                  onClick={() => setSelected('video-url')}
                  scaleFactor={scaleFactor}
                  selected={selected === 'video-url'}
                  active={selectedVideo && selectedVideo.src.startsWith('https://')}
                />
              </UiEntity>
              <UiEntity uiTransform={{ width: '50%', padding: { left: 8 * scaleFactor } }}>
                <CustomButton
                  engine={engine}
                  id="video_control_live"
                  value="<b>LIVE STREAM</b>"
                  icon={ICONS.LIVE_SOURCE}
                  onClick={() => setSelected('live')}
                  active={selectedVideo && selectedVideo.src.startsWith(LIVEKIT_STREAM_SRC)}
                  scaleFactor={scaleFactor}
                  selected={selected === 'live'}
                />
              </UiEntity>
            </UiEntity>
          </UiEntity>
        </UiEntity>
      </Card>
      {selected && selectedEntity && (
        <Card scaleFactor={scaleFactor}>
          {selected === 'video-url' && (
            <VideoControlURL
              engine={engine}
              scaleFactor={scaleFactor}
              entity={selectedEntity}
              video={selectedVideo}
            />
          )}
          {selected === 'live' && (
            <LiveStream
              engine={engine}
              scaleFactor={scaleFactor}
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
  scaleFactor: number;
  icon: string;
  engine: IEngine;
  active?: boolean;
}

function CustomButton({ active, scaleFactor, value, id, onClick, icon, selected, engine }: Props) {
  return (
    <UiEntity uiTransform={{ flexDirection: 'column', height: '100%', width: '100%' }}>
      <UiEntity uiTransform={{ width: '100%' }}>
        <Button
          id={id}
          onMouseDown={onClick}
          value={value}
          fontSize={14 * scaleFactor}
          icon={icon}
          iconTransform={{
            width: 24 * scaleFactor,
            height: 24 * scaleFactor,
            margin: { right: 8 * scaleFactor },
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
              top: 6 * scaleFactor,
              bottom: 6 * scaleFactor,
            },
            borderRadius: 6 * scaleFactor,
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: 36 * scaleFactor,
          }}
        />
      </UiEntity>

      {active && (
        <Active
          scaleFactor={scaleFactor}
          engine={engine}
          uiTransform={{ width: '100%', margin: { top: 6 * scaleFactor } }}
        />
      )}
    </UiEntity>
  );
}
