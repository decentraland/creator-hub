import { Color4 } from '@dcl/sdk/math';
import type { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import ReactEcs, { UiEntity, Label } from '@dcl/react-ecs';
import { copyToClipboard } from '~system/RestrictedActions';
import { LIVEKIT_STREAM_SRC } from '../../../definitions';
import { startTimeout, stopTimeout, startInterval, stopInterval } from '../../../timer';
import { getContentUrl } from '../../constants';
import { Button } from '../../Button';
import { FeedbackButton } from '../../FeedbackButton';
import { getErrorIcon } from '../../Error';
import { LoadingDots } from '../../Loading';
import { VideoControlVolume } from '../VolumeControl';
import { getStreamKey } from '../api';
import { createVideoPlayerControls } from '../utils';
import { state } from '../..';
import { COLORS } from '..';

const STREAM_ICONS = {
  get eyeShow() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/eye.png`;
  },
  get eyeHide() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/eye-off.png`;
  },
};

const AUTO_HIDE_DURATION_SECONDS = 30;
const STREAM_KEY_TIMEOUT_ACTION = 'video_control_stream_key_timeout';
const STREAM_KEY_INTERVAL_ACTION = 'video_control_stream_key_interval';
const RTMP_SERVER_URL = 'rtmps://dcl.rtmp.livekit.cloud/x';

export function ShowStreamKey({
  engine,
  video,
  entity,
  onReset,
  endsAt,
}: {
  endsAt: number;
  engine: IEngine;
  entity: Entity;
  video: DeepReadonlyObject<PBVideoPlayer> | undefined;
  onReset(): void;
}) {
  const controls = createVideoPlayerControls(entity, engine);
  const [showStreamkey, setShowStreamkey] = ReactEcs.useState(false);
  const [loading, setLoading] = ReactEcs.useState(false);
  const [streamKey, setStreamKey] = ReactEcs.useState<string | undefined>(undefined);
  const [timeRemaining, setTimeRemaining] = ReactEcs.useState(AUTO_HIDE_DURATION_SECONDS);

  // auto-hide stream key after specified duration
  ReactEcs.useEffect(() => {
    if (streamKey) {
      setTimeRemaining(AUTO_HIDE_DURATION_SECONDS);

      startTimeout(
        state.adminToolkitUiEntity,
        STREAM_KEY_TIMEOUT_ACTION,
        AUTO_HIDE_DURATION_SECONDS,
        () => {
          setStreamKey(undefined);
          setShowStreamkey(false);
          setTimeRemaining(0);
        },
      );

      startInterval(state.adminToolkitUiEntity, STREAM_KEY_INTERVAL_ACTION, 0.1, () => {
        setTimeRemaining(prev => Math.max(0, prev - 0.1));
      });

      return () => {
        stopTimeout(state.adminToolkitUiEntity, STREAM_KEY_TIMEOUT_ACTION);
        stopInterval(state.adminToolkitUiEntity, STREAM_KEY_INTERVAL_ACTION);
      };
    } else {
      setTimeRemaining(0);
    }
  }, [streamKey]);

  return (
    <UiEntity uiTransform={{ flexDirection: 'column' }}>
      <Label
        value="<b>RTMP Server</b>"
        color={Color4.White()}
        fontSize={16}
        uiTransform={{
          margin: { top: 16, bottom: 8 },
        }}
      />
      <UiEntity
        uiTransform={{
          width: '100%',
          margin: { bottom: 8, top: 8 },
          height: 42,
          borderRadius: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        uiBackground={{ color: Color4.White() }}
      >
        <Label
          uiTransform={{ margin: { left: 16 } }}
          fontSize={16}
          value={`<b>${RTMP_SERVER_URL}</b>`}
          color={Color4.fromHexString('#A09BA8')}
        />
        <FeedbackButton
          id="video_control_copy_rtmp_server"
          value="<b>Copy</b>"
          variant="primary"
          fontSize={16}
          uiTransform={{
            margin: { right: 8 },
            padding: { left: 8, right: 8 },
          }}
          onMouseDown={async () => {
            copyToClipboard({ text: RTMP_SERVER_URL });
          }}
        />
      </UiEntity>
      <Label
        value="<b>Stream Key</b>"
        color={Color4.White()}
        fontSize={16}
        uiTransform={{
          margin: { top: 16, bottom: 8 },
        }}
      />
      <UiEntity
        uiTransform={{
          width: '100%',
          margin: { bottom: 8, top: 8 },
          height: 42,
          borderRadius: 12,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        uiBackground={{ color: Color4.White() }}
      >
        <UiEntity
          uiTransform={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          {loading ? (
            <UiEntity
              uiTransform={{
                margin: { left: 16 },
              }}
            >
              <LoadingDots engine={engine} />
            </UiEntity>
          ) : (
            <Label
              uiTransform={{
                margin: { left: 16 },
                flexShrink: 1,
              }}
              fontSize={16}
              value={`<b>${showStreamkey && streamKey ? streamKey : '************'}</b>`}
              color={Color4.fromHexString('#A09BA8')}
            />
          )}
        </UiEntity>

        <UiEntity
          uiTransform={{
            flexDirection: 'row',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <UiEntity
            uiTransform={{
              width: 25,
              height: 25,
              margin: { right: 10 },
            }}
            uiBackground={{
              textureMode: 'stretch',
              texture: {
                src: showStreamkey && streamKey ? STREAM_ICONS.eyeHide : STREAM_ICONS.eyeShow,
              },
              color: Color4.Black(),
            }}
            onMouseDown={async () => {
              if (!streamKey) {
                setLoading(true);
                const [error, data] = await getStreamKey();
                setLoading(false);
                if (!error && data?.streamingKey) {
                  setStreamKey(data.streamingKey);
                  setShowStreamkey(true);
                }
              } else {
                setShowStreamkey(!showStreamkey);
              }
            }}
          />
          <FeedbackButton
            id="video_control_copy_stream_key"
            value="<b>Copy</b>"
            variant="primary"
            fontSize={16}
            uiTransform={{
              margin: { right: 8 },
              padding: { left: 8, right: 8 },
              minWidth: 60,
            }}
            onMouseDown={async () => {
              if (streamKey) {
                copyToClipboard({ text: streamKey });
              } else {
                setLoading(true);
                const [error, data] = await getStreamKey();
                setLoading(false);
                if (!error && data?.streamingKey) {
                  setStreamKey(data.streamingKey);
                  copyToClipboard({ text: data.streamingKey });
                }
              }
            }}
          />
        </UiEntity>
      </UiEntity>

      <UiEntity
        uiTransform={{
          width: '100%',
          height: 4,
          margin: { top: 8 },
          display: streamKey && timeRemaining > 0 && showStreamkey ? 'flex' : 'none',
        }}
        uiBackground={{ color: Color4.fromHexString('#FFFFFF1A') }}
      >
        <UiEntity
          uiTransform={{
            width: `${(timeRemaining / AUTO_HIDE_DURATION_SECONDS) * 100}%`,
            height: '100%',
          }}
          uiBackground={{ color: Color4.fromHexString('#00D3FF') }}
        />
      </UiEntity>

      <UiEntity
        uiTransform={{
          width: '100%',
          height: 40,
          flexDirection: 'row',
          justifyContent: 'space-between',
          margin: { top: 10, bottom: 16 },
        }}
      >
        {endsAt > Date.now() ? (
          <UiEntity uiTransform={{ flexDirection: 'column' }}>
            <Label
              value="Stream expires in:"
              color={Color4.fromHexString('#FFFFFFB2')}
              fontSize={14}
            />
            <Label
              value={formatTimeRemaining(endsAt)}
              color={Color4.fromHexString('#FFFFFFB2')}
              fontSize={14}
            />
          </UiEntity>
        ) : (
          <UiEntity
            uiTransform={{
              flexDirection: 'row',
              margin: { right: 10 },
              borderWidth: 2,
              borderColor: Color4.Green(),
            }}
          >
            <UiEntity
              uiTransform={{
                width: 15,
                height: 15,
                margin: { right: 4, top: 4 },
              }}
              uiBackground={{
                textureMode: 'stretch',
                texture: {
                  src: getErrorIcon(),
                },
              }}
            />
            <Label
              fontSize={14}
              textAlign="middle-left"
              color={Color4.fromHexString('#FF0000')}
              value="Stream timed out. Please restart stream in broadcasting software."
            />
          </UiEntity>
        )}
        {video?.src === LIVEKIT_STREAM_SRC && state.videoControl.selectedStream === 'live' ? (
          <Button
            id="video_control_share_screen_clear"
            value="<b>Deactivate</b>"
            variant="text"
            fontSize={16}
            color={Color4.White()}
            uiTransform={{
              minWidth: 120,
              margin: { right: 8 },
              padding: { left: 8, right: 8 },
            }}
            onMouseDown={() => {
              controls.setSource('');
              state.videoControl.selectedStream = undefined;
            }}
          />
        ) : (
          <Button
            id="video_control_share_screen_share"
            value="<b>Activate</b>"
            labelTransform={{
              margin: { left: 20, right: 20 },
            }}
            uiTransform={{
              minWidth: 120,
            }}
            fontSize={16}
            uiBackground={{ color: COLORS.SUCCESS }}
            color={Color4.Black()}
            onMouseDown={() => {
              controls.setSource(LIVEKIT_STREAM_SRC);
              state.videoControl.selectedStream = 'live';
            }}
          />
        )}
      </UiEntity>
      <VideoControlVolume
        engine={engine}
        label="<b>Stream Volume</b>"
        entity={entity}
        video={video}
      />
      <UiEntity>
        <Button
          id="video_control_reset_stream_key"
          value="<b>Reset Stream Key</b>"
          variant="text"
          fontSize={16}
          color={Color4.fromHexString('#FB3B3B')}
          uiTransform={{
            margin: { right: 8, top: 20 },
            padding: { left: 8, right: 8 },
          }}
          onMouseDown={() => onReset()}
        />
      </UiEntity>
    </UiEntity>
  );
}

// Helper function to format time remaining - shows days if > 1 day, otherwise shows hh:mm:ss
function formatTimeRemaining(endsAt: number): string {
  const now = Date.now();
  const timeRemaining = Math.max(0, endsAt - now);

  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));

  if (days >= 1) {
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  } else {
    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
