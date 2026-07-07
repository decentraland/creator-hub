import type { IEngine } from '@dcl/ecs';
import type { State } from '../../types';
import { setInterval } from '../../utils';
import { getAdminToolkitVideoControl, getVideoPlayers } from '../utils';
import {
  consumePresentationMessages,
  ensurePresenterRole,
  getActiveStreams,
  getDclCastInfo,
  groupTracksByParticipant,
  hasPresentationTrack,
  subscribeToPresentationTopic,
} from '../api';
import { showcaseState } from './state';

// Background presentation detection.
//
// Runs as a boot-time engine service (for admins) instead of as a side effect of
// the DclCast component mounting, so the panel can auto-open regardless of which
// tab (if any) the admin is viewing. Data flows one way:
//   detector -> state.videoControl.presentationState -> view components.
//
// Auto-open is triggered by the presentation bot's LiveKit TRACK appearing
// (hasPresentationTrack over getActiveStreams) — a signal available to every scene
// participant. Slide-level state (page count, current slide, videos) arrives
// separately over the 'presentation' comms topic, which the bot only serves to
// presenters — hence we promote the admin before subscribing (getDclCastInfo lazily
// creates the room ensurePresenterRole depends on, so the two must be sequenced).

const POLL_INTERVAL_MS = 5000;

let detectionStarted = false;
let presentationSubscribed = false;
let consuming = false;
let presentationSystem: (() => void) | null = null;

async function startPresentationSystem(
  engine: IEngine,
  state: State,
  getPlayerAddress: () => string | undefined,
): Promise<void> {
  if (presentationSystem) return; // Already running
  presentationSubscribed = true; // set synchronously so the poll doesn't re-enter

  // The bot only serves presentation:state to presenters, so promote this admin
  // first. getDclCastInfo lazily creates the room ensurePresenterRole depends on,
  // so it must resolve before ensurePresenterRole (see PR #1356).
  const [, castData] = await getDclCastInfo();
  if (castData) state.videoControl.dclCast = castData;
  const address = getPlayerAddress();
  if (address) await ensurePresenterRole(address);

  subscribeToPresentationTopic();

  // Keep presentationState (slide counter, video state) in sync with the topic.
  const system = () => {
    if (consuming) return;
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
        // Transient — retry on the next frame.
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

function isCastCapableScene(engine: IEngine): boolean {
  const videoControl = getAdminToolkitVideoControl(engine);
  return !!videoControl?.isEnabled && getVideoPlayers(engine).length > 0;
}

export function startPresentationDetection(
  engine: IEngine,
  state: State,
  getIsAdmin: () => boolean,
  getPlayerAddress: () => string | undefined,
  onPresentationStarted: () => void,
): void {
  if (detectionStarted) return;
  detectionStarted = true;

  const poll = async () => {
    // Admins only, and only in scenes with cast screens. Re-checked each tick so
    // detection begins as soon as the player/admin list resolves.
    if (!getIsAdmin() || !isCastCapableScene(engine)) return;

    const tracks = await getActiveStreams();
    if (!tracks) return;

    // Keep the Speaker Showcase list fresh (also drives the compact view's
    // presentation controls via presentationBotInRoom).
    showcaseState.participants = groupTracksByParticipant(tracks);

    const hasPresentation = hasPresentationTrack(tracks);
    if (hasPresentation && !presentationSubscribed) {
      // Bot track just appeared — auto-open now and start syncing slide state.
      onPresentationStarted();
      startPresentationSystem(engine, state, getPlayerAddress);
    } else if (!hasPresentation && presentationSubscribed) {
      stopPresentationSystem(engine, state);
    }
  };

  // Poll immediately, then every 5 seconds.
  poll();
  setInterval(engine, poll, POLL_INTERVAL_MS);
}
