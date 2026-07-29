import type { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ReactEcs is the JSX factory
import ReactEcs, { UiEntity, Label } from '@dcl/react-ecs';
import { copyToClipboard, openExternalUrl } from '~system/RestrictedActions';
import { LIVEKIT_STREAM_SRC } from '../../../definitions';
import { startTimeout, stopTimeout } from '../../../timer';
import { getStreamKey } from '../api';
import { createVideoPlayerControls } from '../utils';
import { COLORS, RADIUS, SPACING, TYPE } from '../../theme';
import { FieldLabel, Icon, Divider } from '../../Primitives';
import { CopyButton, ActionLink, PillButton } from '../../Controls';
import { VolumeSlider } from '../VolumeSlider';
import { state } from '../../store';
import { setStream } from '../../actions';
import { STREAMING_SUPPORT_URL } from '.';

const AUTO_HIDE_DURATION_SECONDS = 30;
const STREAM_KEY_TIMEOUT_ACTION = 'video_control_stream_key_timeout';
const RTMP_SERVER_URL = 'rtmps://dcl.rtmp.livekit.cloud/x';

// A read-only field (RTMP server / stream key) with an optional trailing slot.
function ReadonlyField({ value, trailing }: { value: string; trailing?: ReactEcs.JSX.Element }) {
  return (
    <UiEntity
      uiTransform={{
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 0,
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        padding: { left: SPACING.xl, right: SPACING.xl },
        margin: { right: SPACING.md },
      }}
      uiBackground={{ color: COLORS.inputBackground }}
    >
      <Label
        value={value}
        fontSize={TYPE.body}
        color={COLORS.textPrimary}
      />
      {trailing ? trailing : <UiEntity uiTransform={{ width: 0, height: 0 }} />}
    </UiEntity>
  );
}

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
  const [streamKey, setStreamKey] = ReactEcs.useState<string | undefined>(undefined);
  const isLive = video?.src === LIVEKIT_STREAM_SRC && state.videoControl.selectedStream === 'live';

  ReactEcs.useEffect(() => {
    if (streamKey) {
      startTimeout(
        state.adminToolkitUiEntity,
        STREAM_KEY_TIMEOUT_ACTION,
        AUTO_HIDE_DURATION_SECONDS,
        () => {
          setStreamKey(undefined);
          setShowStreamkey(false);
        },
      );
      return () => {
        stopTimeout(state.adminToolkitUiEntity, STREAM_KEY_TIMEOUT_ACTION);
      };
    }
  }, [streamKey]);

  const revealKey = async () => {
    if (streamKey) {
      setShowStreamkey(!showStreamkey);
      return;
    }
    const [error, data] = await getStreamKey();
    if (!error && data?.streamingKey) {
      setStreamKey(data.streamingKey);
      setShowStreamkey(true);
    }
  };

  const copyKey = async () => {
    if (streamKey) {
      copyToClipboard({ text: streamKey });
      return;
    }
    const [error, data] = await getStreamKey();
    if (!error && data?.streamingKey) {
      setStreamKey(data.streamingKey);
      copyToClipboard({ text: data.streamingKey });
    }
  };

  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
      <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
        <FieldLabel text="RTMP server" />
        <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
          <ReadonlyField value={RTMP_SERVER_URL} />
          <CopyButton
            id="video_control_copy_rtmp_server"
            onCopy={() => copyToClipboard({ text: RTMP_SERVER_URL })}
          />
        </UiEntity>
      </UiEntity>

      <UiEntity
        uiTransform={{ flexDirection: 'column', width: '100%', margin: { top: SPACING.xl } }}
      >
        <FieldLabel text="Stream key" />
        <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
          <ReadonlyField
            value={showStreamkey && streamKey ? streamKey : '••••••••••••'}
            trailing={
              <UiEntity
                uiTransform={{ width: 16, height: 16 }}
                uiBackground={{ color: COLORS.transparent }}
                onMouseDown={revealKey}
              >
                <Icon
                  name={showStreamkey && streamKey ? 'eyeoff' : 'eye'}
                  size={16}
                  color={COLORS.textSecondary}
                />
              </UiEntity>
            }
          />
          <CopyButton
            id="video_control_copy_stream_key"
            onCopy={copyKey}
          />
        </UiEntity>
        <UiEntity
          uiTransform={{ width: '100%', height: 44, margin: { top: SPACING.sm } }}
          uiText={{
            value:
              'Do not share your stream key with anyone, and be careful not to display it on screen while streaming.',
            fontSize: TYPE.label,
            color: COLORS.danger,
            textAlign: 'top-left',
            textWrap: 'wrap',
          }}
        />
      </UiEntity>

      <UiEntity
        uiTransform={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          margin: { top: SPACING.xl },
        }}
      >
        <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon
            name="clock"
            size={14}
            color={endsAt > Date.now() ? COLORS.textSecondary : COLORS.danger}
            uiTransform={{ margin: { right: 5 } }}
          />
          <Label
            value={
              endsAt > Date.now()
                ? `Stream expires in ${formatTimeRemaining(endsAt)}`
                : 'Stream timed out — restart it in your software'
            }
            fontSize={TYPE.label}
            color={endsAt > Date.now() ? COLORS.textSecondary : COLORS.danger}
          />
        </UiEntity>
        <PillButton
          id="video_control_stream_activate"
          label={isLive ? 'Deactivate' : 'Activate'}
          variant="filled"
          onClick={() => {
            if (isLive) {
              controls.setSource('');
              setStream(undefined);
            } else {
              controls.setSource(LIVEKIT_STREAM_SRC);
              setStream('live');
            }
          }}
        />
      </UiEntity>

      <VolumeSlider
        engine={engine}
        entity={entity}
        video={video}
      />

      <Divider uiTransform={{ margin: { top: SPACING.xl } }} />
      <UiEntity
        uiTransform={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          margin: { top: SPACING.xl },
        }}
      >
        <ActionLink
          label="Streaming help"
          iconName="help"
          color={COLORS.textSecondary}
          onClick={() => openExternalUrl({ url: STREAMING_SUPPORT_URL })}
        />
        <ActionLink
          label="Reset stream key"
          iconName="refresh"
          color={COLORS.danger}
          onClick={() => onReset()}
        />
      </UiEntity>
    </UiEntity>
  );
}

// Show days if > 1 day, otherwise hh:mm:ss.
function formatTimeRemaining(endsAt: number): string {
  const now = Date.now();
  const timeRemaining = Math.max(0, endsAt - now);
  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  if (days >= 1) return `${days} ${days === 1 ? 'day' : 'days'}`;
  const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}
