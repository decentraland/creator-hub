import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MdPause, MdPlayArrow, MdRepeat } from 'react-icons/md';
import { PreviewEmote, PreviewEmoteEventType } from '@dcl/schemas';
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
  const lengthRef = useRef(0);
  // The preview reports its exact playhead while playing; it is read once per frame, not per event.
  const timeRef = useRef(0);

  const updateLength = useCallback((seconds: number) => {
    lengthRef.current = seconds;
    setLength(seconds);
  }, []);

  const handleLoad = useCallback(async () => {
    setLoaded(true);
    try {
      controller.current = WearablePreview.createController(id);
      updateLength(await controller.current.emote.getLength());
      setPlaying(await controller.current.emote.isPlaying());
    } catch (error) {
      // No timeline if the preview can't be controlled; the avatar still plays.
      console.warn('Could not control the emote preview:', error);
    }
  }, [id, updateLength]);

  // Listen to the preview's own events: they carry the playhead and tell us when a clip ends.
  useEffect(() => {
    if (!loaded) return;
    const iframe = document.getElementById(id) as HTMLIFrameElement | null;
    const emote = controller.current?.emote;
    let cancelled = false;
    let restartTimer: ReturnType<typeof setTimeout> | undefined;

    // The preview is still winding down when it reports the end, so give it a moment, restart,
    // and check it took; seeking back first is the fallback if a bare play() didn't.
    const restart = () => {
      clearTimeout(restartTimer);
      restartTimer = setTimeout(async () => {
        if (cancelled || !emote || !loopRef.current) return;
        try {
          await emote.play();
          await new Promise(resolve => setTimeout(resolve, 400));
          if (!cancelled && !(await emote.isPlaying())) {
            await emote.goTo(0);
            await emote.play();
          }
        } catch (error) {
          console.warn('Could not loop the animation:', error);
        }
      }, 150);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe?.contentWindow || event.data?.type !== 'emote_event') return;
      const { type, payload } = event.data.payload ?? {};
      switch (type) {
        case PreviewEmoteEventType.ANIMATION_PLAYING:
          if (typeof payload?.length === 'number') timeRef.current = payload.length;
          break;
        case PreviewEmoteEventType.ANIMATION_PLAY:
          setPlaying(true);
          void emote?.getLength().then(seconds => !cancelled && updateLength(seconds));
          break;
        case PreviewEmoteEventType.ANIMATION_PAUSE:
          setPlaying(false);
          setTime(timeRef.current);
          break;
        case PreviewEmoteEventType.ANIMATION_END: {
          setPlaying(false);
          // A stop the user asked for also ends the clip; only a clip that ran out loops.
          const ranOut = timeRef.current >= lengthRef.current - 0.25;
          setTime(ranOut ? lengthRef.current : timeRef.current);
          if (ranOut && loopRef.current) restart();
          break;
        }
      }
    };

    window.addEventListener('message', onMessage);
    return () => {
      cancelled = true;
      clearTimeout(restartTimer);
      window.removeEventListener('message', onMessage);
    };
  }, [loaded, id, updateLength]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      setTime(timeRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const togglePlay = async () => {
    const emote = controller.current?.emote;
    if (!emote) return;
    if (playing) {
      await emote.pause();
    } else {
      // Seeking back first leaves an ended clip unable to play; a bare play() restarts it.
      await emote.play();
    }
  };

  const scrub = async (seconds: number) => {
    const emote = controller.current?.emote;
    timeRef.current = seconds;
    setTime(seconds);
    if (!emote) return;
    const wasPlaying = playing;
    await emote.goTo(seconds);
    if (wasPlaying) await emote.play();
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
        disableAutoRotate
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
            value={Math.min(time, length)}
            onChange={event => scrub(Number(event.target.value))}
            aria-label="Animation position"
            style={
              { '--progress': `${(Math.min(time, length) / length) * 100}%` } as React.CSSProperties
            }
          />
          <span className="EmoteViewer-time">
            {formatSeconds(Math.min(time, length))} / {formatSeconds(length)}
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
