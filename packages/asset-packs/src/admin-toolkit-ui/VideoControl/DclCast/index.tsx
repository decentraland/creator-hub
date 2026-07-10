import ReactEcs, { UiEntity } from '@dcl/react-ecs';
import type { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import { getComponents } from '../../../definitions';
import type { State } from '../../types';
import { Button } from '../../Button';
import { LoadingDots } from '../../Loading';
import { LIVEKIT_STREAM_SRC } from '../LiveStream';
import {
  getDclCastInfo,
  getActiveStreams,
  groupTracksByParticipant,
  resetStreamKey,
  ensurePresenterRole,
  type FlattenedTrack,
} from '../api';
import { CAST_SRC_PREFIX, createVideoPlayerControls } from '../utils';
import {
  openShowcase,
  closeShowcase,
  setShowcaseActiveTrack,
  openSharePresentation,
  closeSharePresentation,
  setStream,
  setParticipants,
  setDclCastInfo,
} from '../../actions';
import { COLORS, SPACING, TYPE } from '../../theme';
import { SectionHeader, Icon } from '../../Primitives';
import DclCastInfo from './DclCastInfo';
import CompactDclCast from './CompactDclCast';
import { getDclCastStyles, getDclCastColors } from './styles';

async function handleGetDclCastInfo() {
  const [error, data] = await getDclCastInfo();
  if (error) {
    console.error(error);
    return null;
  } else {
    if (data) {
      setDclCastInfo(data);
      return data;
    }
  }
}

const DclCast = ({
  engine,
  state,
  entity,
  video,
  playerAddress,
}: {
  engine: IEngine;
  state: State;
  entity: Entity;
  video: DeepReadonlyObject<PBVideoPlayer> | undefined;
  playerAddress: string | undefined;
}) => {
  const { VideoControlState } = getComponents(engine);
  const controls = createVideoPlayerControls(entity, engine);
  const styles = getDclCastStyles();
  const colors = getDclCastColors();
  const [isLoading, setIsLoading] = ReactEcs.useState(false);
  const [error, setError] = ReactEcs.useState(false);

  const onShowShowcaseModal = async () => {
    const latestTracks = await getActiveStreams();
    if (!latestTracks) return;

    setParticipants(groupTracksByParticipant(latestTracks));
    openShowcase({
      onSelectTrack: (track: FlattenedTrack) => {
        controls.setSource(track.sid);
        setShowcaseActiveTrack(track.sid);
        setStream('dcl-cast');
      },
      onSetDefault: () => {
        controls.setSource(LIVEKIT_STREAM_SRC);
        setShowcaseActiveTrack(undefined);
        setStream('dcl-cast');
      },
      onClose: () => closeShowcase(),
    });
  };

  const fetchDclCastInfo = async () => {
    setIsLoading(true);
    setError(false);

    const result = await handleGetDclCastInfo();

    if (!result) {
      setError(true);
    } else if (video?.src?.startsWith(CAST_SRC_PREFIX) && !state.videoControl.selectedStream) {
      setStream('dcl-cast');
    }

    setIsLoading(false);
  };

  const onSharePresentation = () => {
    openSharePresentation(() => closeSharePresentation());
  };

  const handleResetRoomId = async () => {
    setIsLoading(true);
    const [error, data] = await resetStreamKey();
    if (error) {
      setIsLoading(false);
      setError(true);
    } else {
      const videoControl = VideoControlState.getMutable(state.adminToolkitUiEntity);
      videoControl.endsAt = data?.endsAt;
      fetchDclCastInfo();
    }
  };

  ReactEcs.useEffect(() => {
    // ensurePresenterRole requires the stream/room that fetchDclCastInfo creates,
    // so it must run after that call resolves, not in parallel with it (PR #1356).
    fetchDclCastInfo().then(() => {
      if (playerAddress) {
        ensurePresenterRole(playerAddress);
      }
    });
  }, []);

  // Sync selectedStream when video.src arrives after mount (late-joiner fix)
  const videoSrc = video?.src;
  ReactEcs.useEffect(() => {
    if (videoSrc?.startsWith(CAST_SRC_PREFIX) && !state.videoControl.selectedStream) {
      setStream('dcl-cast');
    }
  }, [videoSrc]);

  const isMinimized = state.videoControl.isMinimized;

  return (
    <UiEntity uiTransform={styles.fullContainer}>
      {/* Compact bar — always rendered, toggled via display */}
      <UiEntity uiTransform={{ display: isMinimized ? 'flex' : 'none', width: '100%' }}>
        <CompactDclCast
          engine={engine}
          state={state}
          entity={entity}
          video={video}
          onShowShowcaseModal={onShowShowcaseModal}
        />
      </UiEntity>

      {/* Full panel — always rendered, toggled via display */}
      <UiEntity
        uiTransform={{
          display: isMinimized ? 'none' : 'flex',
          flexDirection: 'column',
          width: '100%',
        }}
      >
        <SectionHeader
          title="DCL Cast room"
          right={
            <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon
                name="clock"
                size={13}
                color={COLORS.textSecondary}
                uiTransform={{ margin: { right: SPACING.xs } }}
              />
              <UiEntity
                uiText={{
                  value: `Expires in ${state.videoControl.dclCast?.expiresInDays ?? 0} days`,
                  fontSize: TYPE.label,
                  color: COLORS.textSecondary,
                }}
              />
            </UiEntity>
          }
        />
        <UiEntity
          uiTransform={{
            width: '100%',
            height: 36,
            margin: { top: SPACING.lg, bottom: SPACING.xl },
          }}
          uiText={{
            value: 'Stream camera and screen from the browser to a screen in your scene.',
            fontSize: TYPE.label,
            color: COLORS.textSecondary,
            textAlign: 'top-left',
            textWrap: 'wrap',
          }}
        />
        {isLoading && (
          <LoadingDots
            uiTransform={styles.loadingContainer}
            engine={engine}
          />
        )}
        {error && (
          <UiEntity uiTransform={styles.columnCentered}>
            <UiEntity
              uiText={{
                value: '<b>Failed to fetch DCL Cast info</b>',
                fontSize: TYPE.subtitle,
                color: COLORS.textPrimary,
              }}
              uiTransform={styles.marginBottomSmall}
            />
            <UiEntity
              uiText={{
                value: 'Please retry.',
                fontSize: TYPE.body,
                color: COLORS.textSecondary,
              }}
            />
            <Button
              id="dcl_cast_retry"
              value="<b>Retry</b>"
              variant="secondary"
              fontSize={TYPE.button}
              color={colors.white}
              onMouseDown={() => {
                fetchDclCastInfo();
              }}
              uiTransform={styles.retryButton}
            />
          </UiEntity>
        )}

        {!isLoading && !error && (
          <DclCastInfo
            state={state}
            entity={entity}
            engine={engine}
            video={video}
            onResetRoomId={handleResetRoomId}
            onShowShowcaseModal={onShowShowcaseModal}
            onSharePresentation={onSharePresentation}
          />
        )}
      </UiEntity>
    </UiEntity>
  );
};

export default DclCast;
