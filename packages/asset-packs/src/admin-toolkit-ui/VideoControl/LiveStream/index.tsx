// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ReactEcs is the JSX factory
import ReactEcs, { UiEntity } from '@dcl/react-ecs';
import type { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import { openExternalUrl } from '~system/RestrictedActions';
import { getComponents } from '../../../definitions';
import { state } from '../..';
import { getStreamKey } from '../api';
import { COLORS, SPACING, TYPE } from '../../theme';
import { SectionHeader, Icon } from '../../Primitives';
import { LoadingDots } from '../../Loading';
import { ShowStreamKey } from './ShowStreamKey';
import { GenerateStreamKey } from './GenerateStreamKey';
import { DeleteStreamKeyConfirmation } from './DeleteStreamKey';

export const LIVEKIT_STREAM_SRC = 'livekit-video://current-stream';
export const STREAMING_SUPPORT_URL =
  'https://docs.decentraland.org/creator/scene-editor/operate-live/live-streaming';

export function LiveStream({
  engine,
  entity,
  video,
}: {
  engine: IEngine;
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
        engine={engine}
        onCancel={() => setResetStreamKey(false)}
        onReset={() => setResetStreamKey(false)}
      />
    );
  }

  return (
    <UiEntity uiTransform={{ flexDirection: 'column', width: '100%' }}>
      <SectionHeader
        title="Stream"
        right={
          <UiEntity
            uiTransform={{ width: 16, height: 16 }}
            uiBackground={{ color: COLORS.transparent }}
            onMouseDown={() => openExternalUrl({ url: STREAMING_SUPPORT_URL })}
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
        uiTransform={{ width: '100%', height: 36, margin: { top: SPACING.lg, bottom: SPACING.xl } }}
        uiText={{
          value:
            'Use this RTMP server and stream key in your broadcasting software to stream to this screen.',
          fontSize: TYPE.label,
          color: COLORS.textSecondary,
          textAlign: 'top-left',
          textWrap: 'wrap',
        }}
      />
      {loading ? (
        <LoadingDots
          uiTransform={{ minHeight: 200 }}
          engine={engine}
        />
      ) : hasStreamKey ? (
        <ShowStreamKey
          endsAt={streamKeyEndsAt ?? 0}
          engine={engine}
          entity={entity}
          video={video}
          onReset={() => setResetStreamKey(true)}
        />
      ) : (
        <GenerateStreamKey
          engine={engine}
          onGenerate={() => setHasStreamKey(true)}
        />
      )}
    </UiEntity>
  );
}
