import { Color4 } from '@dcl/sdk/math';
import { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import ReactEcs, { UiEntity, Label } from '@dcl/react-ecs';
import { copyToClipboard } from '~system/RestrictedActions';
import { COLORS } from '..';
import { createVideoPlayerControls } from '../utils';
import { VideoControlVolume } from '../VolumeControl';
import { Button } from '../../Button';
import { LIVEKIT_STREAM_SRC } from '../../../definitions';
import { ERROR_ICON } from '../../Error';
import { CONTENT_URL } from '../../constants';
import { getStreamKey } from '../api';
import { LoadingDots } from '../../Loading';
import { startTimeout, stopTimeout, startInterval, stopInterval } from '../../../timer';
import { state } from '../..';

const STREAM_ICONS = {
  eyeShow: `${CONTENT_URL}/admin_toolkit/assets/icons/eye.png`,
  eyeHide: `${CONTENT_URL}/admin_toolkit/assets/icons/eye-off.png`,
};

const AUTO_HIDE_DURATION_SECONDS = 30;
const STREAM_KEY_TIMEOUT_ACTION = 'video_control_stream_key_timeout';
const STREAM_KEY_INTERVAL_ACTION = 'video_control_stream_key_interval';
const RTMP_SERVER_URL = 'rtmps://dcl.rtmp.livekit.cloud/x';

export function ShowStreamKey({
  scaleFactor,
  engine,
  video,
  entity,
  onReset,
  endsAt,
}: {
  endsAt: number;
  scaleFactor: number;
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
        fontSize={16 * scaleFactor}
        uiTransform={{
          margin: { top: 16 * scaleFactor, bottom: 8 * scaleFactor },
        }}
      />
      <UiEntity
        uiTransform={{
          width: '100%',
          margin: { bottom: 8 * scaleFactor, top: 8 * scaleFactor },
          height: 42 * scaleFactor,
          borderRadius: 12 * scaleFactor,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        uiBackground={{ color: Color4.White() }}
      >
        <Label
          uiTransform={{ margin: { left: 16 * scaleFactor } }}
          fontSize={16 * scaleFactor}
          value={`<b>${RTMP_SERVER_URL}</b>`}
          color={Color4.fromHexString('#A09BA8')}
        />
        <Button
          id="video_control_copy_rtmp_server"
          value="<b>Copy</b>"
          variant="primary"
          fontSize={16 * scaleFactor}
          uiTransform={{
            margin: { right: 8 * scaleFactor },
            padding: { left: 8 * scaleFactor, right: 8 * scaleFactor },
          }}
          onMouseDown={async () => {
            copyToClipboard({ text: RTMP_SERVER_URL });
          }}
        />
      </UiEntity>
      <Label
        value="<b>Stream Key<b>"
        color={Color4.White()}
        fontSize={16 * scaleFactor}
        uiTransform={{
          margin: { top: 16 * scaleFactor, bottom: 8 * scaleFactor },
        }}
      />
      <UiEntity
        uiTransform={{
          width: '100%',
          margin: { bottom: 8 * scaleFactor, top: 8 * scaleFactor },
          height: 42 * scaleFactor,
          borderRadius: 12 * scaleFactor,
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
                margin: { left: 16 * scaleFactor },
              }}
            >
              <LoadingDots
                scaleFactor={scaleFactor}
                engine={engine}
              />
            </UiEntity>
          ) : (
            <Label
              uiTransform={{
                margin: { left: 16 * scaleFactor },
                flexShrink: 1,
              }}
              fontSize={16 * scaleFactor}
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
              width: 25 * scaleFactor,
              height: 25 * scaleFactor,
              margin: { right: 10 * scaleFactor },
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
          <Button
            id="video_control_copy_stream_key"
            value="<b>Copy</b>"
            variant="primary"
            fontSize={16 * scaleFactor}
            uiTransform={{
              margin: { right: 8 * scaleFactor },
              padding: { left: 8 * scaleFactor, right: 8 * scaleFactor },
              minWidth: 60 * scaleFactor,
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
          height: 4 * scaleFactor,
          margin: { top: 8 * scaleFactor },
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
          height: 40 * scaleFactor,
          flexDirection: 'row',
          justifyContent: 'space-between',
          margin: { top: 10 * scaleFactor, bottom: 16 * scaleFactor },
        }}
      >
        {endsAt > Date.now() ? (
          <UiEntity uiTransform={{ flexDirection: 'column' }}>
            <Label
              value="Stream expires in:"
              color={Color4.fromHexString('#FFFFFFB2')}
              fontSize={14 * scaleFactor}
            />
            <Label
              value={formatTimeRemaining(endsAt)}
              color={Color4.fromHexString('#FFFFFFB2')}
              fontSize={14 * scaleFactor}
            />
          </UiEntity>
        ) : (
          <UiEntity
            uiTransform={{
              flexDirection: 'row',
              margin: { right: 10 * scaleFactor },
              borderWidth: 2,
              borderColor: Color4.Green(),
            }}
          >
            <UiEntity
              uiTransform={{
                width: 15 * scaleFactor,
                height: 15 * scaleFactor,
                margin: { right: 4 * scaleFactor, top: 4 * scaleFactor },
              }}
              uiBackground={{
                textureMode: 'stretch',
                texture: {
                  src: ERROR_ICON,
                },
              }}
            />
            <Label
              fontSize={14 * scaleFactor}
              textAlign="middle-left"
              color={Color4.fromHexString('#FF0000')}
              value="Stream timed out. Please restart stream in broadcasting software."
            />
          </UiEntity>
        )}
        {video?.src === LIVEKIT_STREAM_SRC ? (
          <Button
            id="video_control_share_screen_clear"
            value="<b>Deactivate</b>"
            variant="text"
            fontSize={16 * scaleFactor}
            color={Color4.White()}
            uiTransform={{
              minWidth: 120 * scaleFactor,
              margin: { right: 8 * scaleFactor },
              padding: { left: 8 * scaleFactor, right: 8 * scaleFactor },
            }}
            onMouseDown={() => {
              controls.setSource('');
            }}
          />
        ) : (
          <Button
            id="video_control_share_screen_share"
            value="<b>Activate</b>"
            labelTransform={{
              margin: { left: 20 * scaleFactor, right: 20 * scaleFactor },
            }}
            uiTransform={{
              minWidth: 120 * scaleFactor,
            }}
            fontSize={16 * scaleFactor}
            uiBackground={{ color: COLORS.SUCCESS }}
            color={Color4.Black()}
            onMouseDown={() => {
              controls.setSource(LIVEKIT_STREAM_SRC);
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
          fontSize={16 * scaleFactor}
          color={Color4.fromHexString('#FB3B3B')}
          uiTransform={{
            margin: { right: 8 * scaleFactor, top: 20 * scaleFactor },
            padding: { left: 8 * scaleFactor, right: 8 * scaleFactor },
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
