import { Color4 } from '@dcl/sdk/math';
import { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import ReactEcs, { UiEntity, Label } from '@dcl/react-ecs';
import { ICONS } from '..';
import { Header } from '../../Header';
import { ShowStreamKey } from './ShowStreamKey';
import { GenerateStreamKey } from './GenerateStreamKey';
import { DeleteStreamKeyConfirmation } from './DeleteStreamKey';
import { state } from '../..';
import { getComponents } from '../../../definitions';
import { getStreamKey } from '../api';
import { LoadingDots } from '../../Loading';
import { openExternalUrl } from '~system/RestrictedActions';
import { HELP_ICON } from '../VideoUrl';

export const LIVEKIT_STREAM_SRC = 'livekit-video://current-stream';
export const STREAMING_SUPPORT_URL = 'https://docs.decentraland.org//creator/editor/live-streaming';

export function LiveStream({
  engine,
  scaleFactor,
  entity,
  video,
}: {
  engine: IEngine;
  scaleFactor: number;
  entity: Entity;
  video: DeepReadonlyObject<PBVideoPlayer> | undefined;
}) {
  const [showResetStreamKey, setResetStreamKey] = ReactEcs.useState<boolean>(false);
  const [loading, setLoading] = ReactEcs.useState<boolean>(false);
  const [hasStreamKey, setHasStreamKey] = ReactEcs.useState<boolean>(false);
  const { VideoControlState } = getComponents(engine);
  const videoControlState = VideoControlState.getOrNull(state.adminToolkitUiEntity);
  const streamKeyEndsAt = videoControlState?.endsAt;

  ReactEcs.useEffect(() => {
    async function streamKeyFn() {
      setLoading(true);
      const [error, data] = await getStreamKey();
      const videoControlState = VideoControlState.getMutable(state.adminToolkitUiEntity);
      if (error) {
        videoControlState.endsAt = undefined;
        setHasStreamKey(false);
      } else {
        videoControlState.endsAt = data?.endsAt;
        setHasStreamKey(true);
      }
      setLoading(false);
    }
    streamKeyFn();
  }, []);

  if (showResetStreamKey) {
    return (
      <DeleteStreamKeyConfirmation
        scaleFactor={scaleFactor}
        engine={engine}
        onCancel={() => setResetStreamKey(false)}
        onReset={() => {
          setResetStreamKey(false);
        }}
      />
    );
  }

  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
      <UiEntity uiTransform={{ width: '100%', justifyContent: 'space-between' }}>
        <Header
          iconSrc={ICONS.LIVE_SOURCE}
          title="Stream"
          scaleFactor={scaleFactor}
        />
        <UiEntity
          onMouseDown={() => openExternalUrl({ url: STREAMING_SUPPORT_URL })}
          uiTransform={{
            width: 25 * scaleFactor,
            height: 25 * scaleFactor,
            alignItems: 'center',
          }}
          uiBackground={{
            textureMode: 'stretch',
            color: Color4.White(),
            texture: {
              src: HELP_ICON,
            },
          }}
        />
      </UiEntity>
      <Label
        textAlign="middle-left"
        value="Use the RTMP server and stream key below in your broadcasting software to start streaming to this screen."
        color={Color4.fromHexString('#A09BA8')}
        fontSize={16 * scaleFactor}
      />
      {loading ? (
        <LoadingDots
          uiTransform={{ minHeight: 400 * scaleFactor }}
          scaleFactor={scaleFactor}
          engine={engine}
        />
      ) : hasStreamKey ? (
        <ShowStreamKey
          endsAt={streamKeyEndsAt ?? 0}
          scaleFactor={scaleFactor}
          engine={engine}
          entity={entity}
          video={video}
          onReset={() => setResetStreamKey(true)}
        />
      ) : (
        <GenerateStreamKey
          scaleFactor={scaleFactor}
          engine={engine}
          onGenerate={() => setHasStreamKey(true)}
        />
      )}
      {!hasStreamKey && (
        <Label
          fontSize={14 * scaleFactor}
          color={Color4.fromHexString('#FF2D55')}
          value="Do not share your stream key with anyone, and be careful not to display it on screen while streaming."
        />
      )}
    </UiEntity>
  );
}
