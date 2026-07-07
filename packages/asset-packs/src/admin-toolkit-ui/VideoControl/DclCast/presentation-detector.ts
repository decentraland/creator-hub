import type { IEngine } from '@dcl/ecs';
import type { State } from '../../types';
import { clearInterval, setInterval } from '../../utils';
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

// Detection lifecycle (module singletons, reset by stopPresentationDetection).
let detectionStarted = false;
let intervalSystem: ((dt: number) => void) | null = null;

// Presentation lifecycle. presentationActive is an edge tracker for the bot
// track (drives the one-shot auto-open); presentationSystem is the running
// consume system (null = not running) and is only assigned on successful setup,
// so a failed setup naturally retries on the next poll tick. startingSystem
// guards against concurrent setup while an in-flight attempt is awaiting.
let presentationActive = false;
let startingSystem = false;
let presentationSystem: (() => void) | null = null;
let consuming = false;

async function startPresentationSystem(
  engine: IEngine,
  state: State,
  getPlayerAddress: () => string | undefined,
): Promise<void> {
  if (presentationSystem || startingSystem) return;
  startingSystem = true;

  try {
    // The bot only serves presentation:state to presenters, so promote this admin
    // first. getDclCastInfo lazily creates the room ensurePresenterRole depends on,
    // so it must resolve before ensurePresenterRole (see PR #1356).
    const [, castData] = await getDclCastInfo();
    if (castData) state.videoControl.dclCast = castData;
    const address = getPlayerAddress();
    if (address) await ensurePresenterRole(address);

    // The presentation may have ended while we were setting up — bail so we don't
    // leave an orphaned system running for a presentation that's already gone.
    if (!presentationActive) return;

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
        .catch(error => {
          // consumePresentationMessages swallows its own errors and resolves to
          // undefined, so this only fires on an unexpected rejection — log it
          // rather than dropping it silently, then retry on the next frame.
          console.error('[DclCast] Failed to consume presentation messages', error);
        })
        .finally(() => {
          consuming = false;
        });
    };

    engine.addSystem(system);
    presentationSystem = system;
  } catch (error) {
    // Setup failed (e.g. a network call rejected). Leave presentationSystem null
    // so the next poll tick retries instead of wedging detection permanently.
    console.error('[DclCast] Failed to start presentation system, will retry', error);
  } finally {
    startingSystem = false;
  }
}

function stopPresentationSystem(engine: IEngine, state: State): void {
  if (presentationSystem) {
    engine.removeSystem(presentationSystem);
    presentationSystem = null;
  }
  state.videoControl.presentationState = undefined;
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
    if (hasPresentation) {
      // Auto-open once, on the track-appeared edge — independent of whether the
      // consume system has finished (or failed) its setup, so a setup retry never
      // re-opens the panel the admin may have since closed.
      if (!presentationActive) {
        presentationActive = true;
        onPresentationStarted();
      }
      // Ensure the consume system is running. Retries a previously failed setup
      // because presentationSystem is only assigned on success.
      await startPresentationSystem(engine, state, getPlayerAddress);
    } else if (presentationActive) {
      presentationActive = false;
      stopPresentationSystem(engine, state);
    }
  };

  // Poll immediately, then every 5 seconds.
  poll();
  intervalSystem = setInterval(engine, poll, POLL_INTERVAL_MS);
}

// Cleanup/reset path: removes the poll interval and consume systems from the
// engine and resets all module state so detection can be safely restarted (e.g.
// on UI teardown or in tests). Without this the module singletons persist and
// the boot-time `detectionStarted` guard would block any restart.
export function stopPresentationDetection(engine: IEngine, state: State): void {
  if (intervalSystem) {
    clearInterval(engine, intervalSystem);
    intervalSystem = null;
  }
  stopPresentationSystem(engine, state);
  detectionStarted = false;
  presentationActive = false;
  startingSystem = false;
  consuming = false;
}
