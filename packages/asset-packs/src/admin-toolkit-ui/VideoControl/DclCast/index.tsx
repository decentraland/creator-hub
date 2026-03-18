import ReactEcs, { UiEntity } from '@dcl/react-ecs';
import type { DeepReadonlyObject, Entity, IEngine, PBVideoPlayer } from '@dcl/ecs';
import { Color4 } from '@dcl/sdk/math';
import { getComponents } from '../../../definitions';
import { getContentUrl } from '../../constants';
import type { State } from '../../types';
import { Button } from '../../Button';
import { LoadingDots } from '../../Loading';
import { nextTickFunctions } from '../..';
import { LIVEKIT_STREAM_SRC } from '../LiveStream';
import {
  getDclCastInfo,
  getActiveStreams,
  groupTracksByParticipant,
  resetStreamKey,
  type FlattenedTrack,
  type Participant,
} from '../api';
import { createVideoPlayerControls } from '../utils';
import DclCastInfo from './DclCastInfo';
import CompactDclCast from './CompactDclCast';
import { getDclCastStyles, getDclCastColors } from './styles';

const ICONS = {
  get DCL_CAST_ICON() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/video-control-dcl-cast.png`;
  },
  get CHEVRON_UP() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/chevron-up.png`;
  },
};

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

const DclCast = ({
  engine,
  state,
  entity,
  video,
}: {
  engine: IEngine;
  state: State;
  entity: Entity;
  video: DeepReadonlyObject<PBVideoPlayer> | undefined;
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
    }

    setIsLoading(false);
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
  }, []);

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
        <UiEntity uiTransform={styles.rowCenterSpaceBetween}>
          <UiEntity uiTransform={styles.rowCenter}>
            <UiEntity
              uiTransform={styles.headerIcon}
              uiBackground={{
                textureMode: 'stretch',
                texture: { src: ICONS.DCL_CAST_ICON },
              }}
            />
            <UiEntity
              uiText={{
                value: '<b>DCL Cast</b>',
                fontSize: 24,
                color: Color4.White(),
                textAlign: 'middle-left',
              }}
              uiTransform={{ margin: { left: 10 } }}
            />
          </UiEntity>
          <UiEntity
            onMouseDown={() => {
              state.videoControl.isMinimized = true;
            }}
            uiTransform={styles.chevronButton}
            uiBackground={{
              textureMode: 'stretch',
              color: Color4.White(),
              texture: {
                src: ICONS.CHEVRON_UP,
              },
            }}
          />
        </UiEntity>
        <UiEntity uiTransform={styles.fullWidthWithBottomMargin}>
          <UiEntity
            uiText={{
              value:
                'Use a browser-based DCL Cast room to easily stream camera and screen feed to a screen in your scene.',
              fontSize: 16,
              color: Color4.fromHexString('#A09BA8'),

              textAlign: 'top-left',
              textWrap: 'wrap',
            }}
            uiTransform={styles.marginBottomSmall}
          />
        </UiEntity>
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
                fontSize: 16,
                color: Color4.White(),
              }}
              uiTransform={styles.marginBottomSmall}
            />
            <UiEntity
              uiText={{
                value: 'Please retry.',
                fontSize: 16,
                color: Color4.Gray(),
              }}
            />
            <Button
              id="dcl_cast_retry"
              value="<b>Retry</b>"
              variant="secondary"
              fontSize={16}
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
          />
        )}
      </UiEntity>
    </UiEntity>
  );
};

export default DclCast;
