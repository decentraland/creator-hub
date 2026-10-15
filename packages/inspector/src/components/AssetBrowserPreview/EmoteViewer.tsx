import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MdPause, MdPlayArrow, MdRepeat } from 'react-icons/md';
import { PreviewEmote } from '@dcl/schemas';
import { WearablePreview } from 'decentraland-ui';
import { toEmoteWithBlobs } from '../AssetPreview/utils';

/**
 * Built-in animations have no file to play, but the avatar preview knows a few of them by name.
 * Keys are the names scene code uses (`triggerEmote({ predefinedEmote })`).
 */
const BUILT_IN_PREVIEW_EMOTES: Record<string, PreviewEmote> = {
  clap: PreviewEmote.CLAP,
  dab: PreviewEmote.DAB,
  money: PreviewEmote.MONEY,
  fistpump: PreviewEmote.FIST_PUMP,
  headexplode: PreviewEmote.HEAD_EXPLODE,
};

export function getBuiltInPreviewEmote(name?: string): PreviewEmote | undefined {
  return name ? BUILT_IN_PREVIEW_EMOTES[name] : undefined;
}

type Props = {
  /** An emote file to play on the avatar... */
  file?: File;
  /** ...or one of the avatar preview's own named emotes. */
  previewEmote?: PreviewEmote;
};

const LOOP_KEY = 'inspector:preview-emote-loop';

function readLoop(): boolean {
  try {
    return localStorage.getItem(LOOP_KEY) !== 'false';
  } catch {
    return true;
  }
}

const formatSeconds = (seconds: number) => `${seconds.toFixed(1)}s`;

/**
 * Plays an emote animation on the default Decentraland avatar, fully dressed so the pose reads
 * clearly (the import dialog's black, faceless silhouette is only meant for thumbnails), with a
 * small timeline and a loop toggle.
 */
export function EmoteViewer({ file, previewEmote }: Props) {
  const id = `emote-${file?.name ?? previewEmote}`;
  const blob = useMemo(() => (file ? toEmoteWithBlobs(file) : undefined), [file]);
  // The avatar comes from an external service and can take a while to appear.
  const [loaded, setLoaded] = useState(false);
  const [length, setLength] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(readLoop);

  const controller = useRef<ReturnType<typeof WearablePreview.createController>>();
  const loopRef = useRef(loop);
  loopRef.current = loop;
  // The preview never reports where the playhead is, so it is tracked from the play/pause events.
  const clock = useRef({ base: 0, startedAt: 0 });

  const startClock = useCallback((from: number) => {
    clock.current = { base: from, startedAt: performance.now() };
  }, []);

  const handleLoad = useCallback(async () => {
    setLoaded(true);
    try {
      controller.current = WearablePreview.createController(id);
      setLength(await controller.current.emote.getLength());
    } catch (error) {
      // No timeline if the preview can't be controlled; the avatar still plays.
      console.warn('Could not control the emote preview:', error);
    }
  }, [id]);

  // The preview's play/pause events don't reliably reach us, so ask it a few times a second and
  // keep our own playhead clock in between. Reaching the end of the clip is also detected here,
  // which is what makes looping possible without reloading the avatar.
  useEffect(() => {
    if (!loaded || !length) return;
    let cancelled = false;
    let busy = false;
    let wasPlaying = false;

    const poll = async () => {
      const emote = controller.current?.emote;
      if (!emote || busy) return;
      busy = true;
      try {
        const nowPlaying = await emote.isPlaying();
        if (cancelled) return;
        const clockNow = clock.current;
        const elapsed = (performance.now() - clockNow.startedAt) / 1000;
        if (nowPlaying && !wasPlaying) clockNow.startedAt = performance.now();
        if (!nowPlaying && wasPlaying) {
          const reached = Math.min(length, clockNow.base + elapsed);
          clockNow.base = reached;
          // Stopped on its own at the end of the clip (not paused by the user): loop it. The
          // restart has to wait for the preview to finish stopping, or it would undo the restart.
          if (loopRef.current && reached >= length - 0.5) {
            clockNow.base = 0;
            await emote.goTo(0);
            await emote.play();
            clockNow.startedAt = performance.now();
            wasPlaying = true;
            setPlaying(true);
            return;
          }
        }
        wasPlaying = nowPlaying;
        setPlaying(nowPlaying);
      } catch (error) {
        console.warn('Could not read the emote state:', error);
      } finally {
        busy = false;
      }
    };

    const timer = setInterval(poll, 200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loaded, length]);

  useEffect(() => {
    if (!playing || !length) return;
    let frame = 0;
    const tick = () => {
      const elapsed = (performance.now() - clock.current.startedAt) / 1000;
      setTime(Math.min(length, clock.current.base + elapsed));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, length]);

  const togglePlay = async () => {
    const emote = controller.current?.emote;
    if (!emote) return;
    if (playing) {
      await emote.pause();
    } else {
      if (time >= length) {
        startClock(0);
        await emote.goTo(0);
      }
      await emote.play();
    }
  };

  const scrub = async (seconds: number) => {
    setTime(seconds);
    startClock(seconds);
    await controller.current?.emote.goTo(seconds);
  };

  const toggleLoop = () => {
    setLoop(value => {
      try {
        localStorage.setItem(LOOP_KEY, String(!value));
      } catch {
        // the choice just won't be remembered
      }
      return !value;
    });
  };

  return (
    <div className="ModelViewer EmoteViewer">
      <WearablePreview
        id={id}
        blob={blob}
        emote={previewEmote}
        profile="default"
        disableBackground
        wheelZoom={2}
        onLoad={handleLoad}
      />
      {!loaded && <div className="PreviewPane-spinner" />}
      <span className="EmoteViewer-badge">Emote · previewed on avatar</span>
      {loaded && length > 0 && (
        <div className="EmoteViewer-timeline">
          <button
            onClick={togglePlay}
            title={playing ? 'Pause' : 'Play'}
            aria-label={playing ? 'Pause animation' : 'Play animation'}
          >
            {playing ? <MdPause /> : <MdPlayArrow />}
          </button>
          <input
            type="range"
            min={0}
            max={length}
            step={0.01}
            value={time}
            onChange={event => scrub(Number(event.target.value))}
            aria-label="Animation position"
            style={{ '--progress': `${(time / length) * 100}%` } as React.CSSProperties}
          />
          <span className="EmoteViewer-time">
            {formatSeconds(time)} / {formatSeconds(length)}
          </span>
          <button
            className={loop ? 'active' : ''}
            onClick={toggleLoop}
            title={loop ? 'Loop on' : 'Loop off'}
            aria-label="Toggle loop"
            aria-pressed={loop}
          >
            <MdRepeat />
          </button>
        </div>
      )}
    </div>
  );
}
