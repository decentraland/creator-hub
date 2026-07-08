import ReactEcs, { UiEntity } from '@dcl/react-ecs';
import type { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import { getComponents } from '../../../definitions';
import type { State } from '../../types';
import { setInterval, clearInterval } from '../../utils';
import { Button } from '../../Button';
import { LoadingDots } from '../../Loading';
import { nextTickFunctions } from '../..';
import { LIVEKIT_STREAM_SRC } from '../LiveStream';
import {
  getDclCastInfo,
  getActiveStreams,
  groupTracksByParticipant,
  resetStreamKey,
  hasPresentationTrack,
  subscribeToPresentationTopic,
  consumePresentationMessages,
  ensurePresenterRole,
  type FlattenedTrack,
  type Participant,
} from '../api';
import { createVideoPlayerControls, isDclCast } from '../utils';
import { COLORS, SPACING, TYPE } from '../../theme';
import { SectionHeader, Icon } from '../../Primitives';
import DclCastInfo from './DclCastInfo';
import CompactDclCast from './CompactDclCast';
import { getDclCastStyles, getDclCastColors } from './styles';

export const showcaseState: {
  show: boolean;
  participants: Participant[];
  activeTrackSid: string | undefined;
  onSelectTrack: ((track: FlattenedTrack) => void) | undefined;
  onSetDefault: (() => void) | undefined;
  onClose: (() => void) | undefined;
} = {
  show: false,
  participants: [],
  activeTrackSid: undefined,
  onSelectTrack: undefined,
  onSetDefault: undefined,
  onClose: undefined,
};

export const sharePresentationState: {
  show: boolean;
  onClose: (() => void) | undefined;
} = {
  show: false,
  onClose: undefined,
};

let presentationSubscribed = false;
let consuming = false;
let presentationSystem: (() => void) | null = null;
let participantPollingSystem: ((dt: number) => void) | null = null;

export async function handleGetDclCastInfo(state: State) {
  const [error, data] = await getDclCastInfo();
  if (error) {
    console.error(error);
    return null;
  } else {
    if (data) {
      state.videoControl.dclCast = data;
      return data;
    }
  }
}

function startPresentationSystem(engine: IEngine, state: State): void {
  if (presentationSystem) return; // Already running
  presentationSubscribed = true;
  subscribeToPresentationTopic();

  const system = () => {
    if (consuming) return; // Prevent concurrent requests
    consuming = true;
    consumePresentationMessages()
      .then(latestState => {
        if (latestState === 'stopped') {
          state.videoControl.presentationState = undefined;
        } else if (latestState) {
          state.videoControl.presentationState = latestState;
        }
      })
      .catch(() => {
        // Silently ignore — will retry next frame
        console.log('[DclCast] Failed to consume presentation messages');
      })
      .finally(() => {
        consuming = false;
      });
  };

  engine.addSystem(system);
  presentationSystem = system;
}

function stopPresentationSystem(engine: IEngine, state: State): void {
  if (presentationSystem) {
    engine.removeSystem(presentationSystem);
    presentationSystem = null;
  }
  state.videoControl.presentationState = undefined;
  presentationSubscribed = false;
}

function startParticipantPolling(engine: IEngine, state: State): void {
  if (participantPollingSystem) return; // Already polling

  const poll = async () => {
    const tracks = await getActiveStreams();
    if (!tracks) return;

    // Debug: log tracks on each poll to review presentation bot metadata
    // console.log('[DclCast] Poll tracks:', JSON.stringify(tracks, null, 2));

    // Keep showcase modal data fresh
    showcaseState.participants = groupTracksByParticipant(tracks);

    // Check for presentation track
    const hasPresentation = hasPresentationTrack(tracks);

    // console.log(`[DclCast] Presentation track ${hasPresentation ? 'found' : 'not found'} in poll`);

    if (hasPresentation && !presentationSubscribed) {
      startPresentationSystem(engine, state);
    } else if (!hasPresentation && presentationSubscribed) {
      stopPresentationSystem(engine, state);
    }
  };

  // Poll immediately, then every 5 seconds
  poll();
  participantPollingSystem = setInterval(engine, poll, 5000);
}

function stopParticipantPolling(engine: IEngine, state: State): void {
  if (participantPollingSystem) {
    clearInterval(engine, participantPollingSystem);
    participantPollingSystem = null;
  }
  stopPresentationSystem(engine, state);
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

    // Debug: log all track data to review presentation bot metadata
    console.log('[DclCast] Active tracks:', JSON.stringify(latestTracks, null, 2));

    const closeModal = () => {
      showcaseState.show = false;
    };

    showcaseState.participants = groupTracksByParticipant(latestTracks);

    showcaseState.onSelectTrack = (track: FlattenedTrack) => {
      controls.setSource(track.sid);
      showcaseState.activeTrackSid = track.sid;
      state.videoControl.selectedStream = 'dcl-cast';
    };

    showcaseState.onSetDefault = () => {
      controls.setSource(LIVEKIT_STREAM_SRC);
      showcaseState.activeTrackSid = undefined;
      state.videoControl.selectedStream = 'dcl-cast';
    };

    showcaseState.onClose = closeModal;

    nextTickFunctions.push(() => {
      showcaseState.show = true;
    });
  };

  const fetchDclCastInfo = async () => {
    setIsLoading(true);
    setError(false);

    const result = await handleGetDclCastInfo(state);

    if (!result) {
      setError(true);
    } else if (video?.src?.startsWith('livekit-video://') && !state.videoControl.selectedStream) {
      state.videoControl.selectedStream = 'dcl-cast';
    }

    setIsLoading(false);
  };

  const onSharePresentation = () => {
    sharePresentationState.onClose = () => {
      sharePresentationState.show = false;
    };
    nextTickFunctions.push(() => {
      sharePresentationState.show = true;
    });
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
    fetchDclCastInfo();
    if (playerAddress) {
      ensurePresenterRole(playerAddress);
    }
  }, []);

  // Sync selectedStream when video.src arrives after mount (late-joiner fix)
  const videoSrc = video?.src;
  ReactEcs.useEffect(() => {
    if (videoSrc?.startsWith('livekit-video://') && !state.videoControl.selectedStream) {
      state.videoControl.selectedStream = 'dcl-cast';
    }
  }, [videoSrc]);

  const isCastActive = !!(video?.src && isDclCast(video.src));

  ReactEcs.useEffect(() => {
    if (isCastActive) {
      startParticipantPolling(engine, state);
    } else {
      stopParticipantPolling(engine, state);
    }
  }, [isCastActive]);

  // Presentation controls now render inline in the full DCL Cast room
  // (DclCastInfo), so no auto-minimize is needed.
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
                handleGetDclCastInfo(state);
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
