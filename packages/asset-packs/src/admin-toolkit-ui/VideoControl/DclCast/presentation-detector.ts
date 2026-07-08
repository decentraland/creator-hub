import type { IEngine } from '@dcl/ecs';
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
import {
  setParticipants,
  setDclCastInfo,
  setPresentationState,
  clearPresentationState,
} from '../../actions';

// Background presentation detection.
//
// Runs as a boot-time engine service (for admins) instead of as a side effect of
// the DclCast component mounting, so the panel can auto-open regardless of which
// tab (if any) the admin is viewing. Data flows one way:
//   detector -> (actions) -> state.videoControl -> view components.
// It never reads or assigns `state` directly — all writes go through actions,
// which own the store singleton.
//
// Auto-open is triggered by the presentation bot's LiveKit TRACK appearing
// (hasPresentationTrack over getActiveStreams) — a signal available to every scene
// participant. Slide-level state (page count, current slide, videos) arrives
// separately over the 'presentation' comms topic, which the bot only serves to
// presenters — hence we promote the admin before subscribing (getDclCastInfo lazily
// creates the room ensurePresenterRole depends on, so the two must be sequenced).

// Detection poll cadence. The poll runs continuously — it never stops on detect —
// because it is the authoritative teardown/re-arm path and the only backstop for an
// ungraceful bot exit that sends no `presentation:stopped`. Its cost (one runtime
// call per second) is dwarfed by the consume system below, so keep it continuous;
// do not "optimize" it into a stop-on-detect, which would wedge detection.
const POLL_INTERVAL_MS = 1000;
// Status consume cadence. ~4Hz is visually instant for a slide counter / video state
// and far cheaper than draining the comms topic every frame.
const CONSUME_INTERVAL_MS = 250;

// Boot-once guard: the poll is registered exactly once per session and runs for the
// scene's lifetime (see the POLL_INTERVAL_MS note above).
let detectionStarted = false;

// Presentation lifecycle. presentationActive is an edge tracker for the bot
// track (drives the one-shot auto-open); presentationSystem is the running
// consume system (null = not running) and is only assigned on successful setup,
// so a failed setup naturally retries on the next poll tick. startingSystem
// guards against concurrent setup while an in-flight attempt is awaiting, and
// polling / consuming guard against a slow tick overlapping the next one.
let presentationActive = false;
let startingSystem = false;
let presentationSystem: ((dt: number) => void) | null = null;
let polling = false;
let consuming = false;

async function startPresentationSystem(
  engine: IEngine,
  getPlayerAddress: () => string | undefined,
  onPresentationEnded: () => void,
): Promise<void> {
  if (presentationSystem || startingSystem) return;
  startingSystem = true;

  try {
    // The bot only serves presentation:state to presenters, so promote this admin
    // first. getDclCastInfo lazily creates the room ensurePresenterRole depends on,
    // so it must resolve before ensurePresenterRole (see PR #1356).
    const [, castData] = await getDclCastInfo();
    if (castData) setDclCastInfo(castData);
    const address = getPlayerAddress();
    if (address) await ensurePresenterRole(address);

    // The presentation may have ended while we were setting up — bail so we don't
    // leave an orphaned system running for a presentation that's already gone.
    if (!presentationActive) return;

    subscribeToPresentationTopic();

    // Keep presentationState (slide counter, video state) in sync with the topic,
    // throttled to CONSUME_INTERVAL_MS — draining every frame is far more than a
    // slide counter needs. The `consuming` guard prevents overlap if a drain
    // outlasts one interval; each drain returns the latest state, so throttling
    // never drops the final message (including `presentation:stopped`).
    const consume = () => {
      if (consuming) return;
      consuming = true;
      consumePresentationMessages()
        .then(latestState => {
          if (latestState === 'stopped') {
            onPresentationEnded();
          } else if (latestState) {
            setPresentationState(latestState);
          }
        })
        .catch(error => {
          // consumePresentationMessages swallows its own errors and resolves to
          // undefined, so this only fires on an unexpected rejection — log it
          // rather than dropping it silently, then retry on the next tick.
          console.error('[DclCast] Failed to consume presentation messages', error);
        })
        .finally(() => {
          consuming = false;
        });
    };

    presentationSystem = setInterval(engine, consume, CONSUME_INTERVAL_MS);
  } catch (error) {
    // Setup failed (e.g. a network call rejected). Leave presentationSystem null
    // so the next poll tick retries instead of wedging detection permanently.
    console.error('[DclCast] Failed to start presentation system, will retry', error);
  } finally {
    startingSystem = false;
  }
}

function stopPresentationSystem(engine: IEngine): void {
  if (presentationSystem) {
    clearInterval(engine, presentationSystem);
    presentationSystem = null;
  }
  clearPresentationState();
}

function isCastCapableScene(engine: IEngine): boolean {
  const videoControl = getAdminToolkitVideoControl(engine);
  return !!videoControl?.isEnabled && getVideoPlayers(engine).length > 0;
}

export function startPresentationDetection(
  engine: IEngine,
  getIsAdmin: () => boolean,
  getPlayerAddress: () => string | undefined,
  onPresentationStarted: () => void,
  onPresentationEnded: () => void,
): void {
  if (detectionStarted) return;
  detectionStarted = true;

  const poll = async () => {
    // Admins only, and only in scenes with cast screens. Re-checked each tick so
    // detection begins as soon as the player/admin list resolves.
    if (!getIsAdmin() || !isCastCapableScene(engine)) return;

    // Skip if a previous tick is still in flight — getActiveStreams and the system
    // setup it triggers can outlast POLL_INTERVAL_MS. Mirrors the `consuming` guard.
    if (polling) return;
    polling = true;
    try {
      const tracks = await getActiveStreams();
      if (!tracks) return;

      // Keep the Speaker Showcase list fresh (also drives the compact view's
      // presentation controls via presentationBotInRoom).
      setParticipants(groupTracksByParticipant(tracks));

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
        await startPresentationSystem(engine, getPlayerAddress, onPresentationEnded);
      } else if (presentationActive) {
        presentationActive = false;
        onPresentationEnded();
        stopPresentationSystem(engine);
      }
    } catch (error) {
      // A rejected network call (getActiveStreams) or setup step would otherwise
      // surface as an unhandled rejection; log and retry on the next tick.
      console.error('[DclCast] Presentation detection poll failed, will retry', error);
    } finally {
      polling = false;
    }
  };

  // Poll immediately, then every second. The handle is intentionally discarded:
  // detection runs for the scene's lifetime and is never torn down.
  poll();
  setInterval(engine, poll, POLL_INTERVAL_MS);
}
