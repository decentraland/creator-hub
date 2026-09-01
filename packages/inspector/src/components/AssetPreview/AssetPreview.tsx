import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AiOutlineSound as AudioIcon } from 'react-icons/ai';
import { IoVideocamOutline as VideoIcon } from 'react-icons/io5';
import { FaFile as OtherIcon } from 'react-icons/fa';
import { SiTypescript as ScriptIcon } from 'react-icons/si';
import cx from 'classnames';
import { PreviewCamera, PreviewProjection } from '@dcl/schemas';
import { WearablePreview } from 'decentraland-ui';

import { Loading } from '../Loading';
import { toEmoteWithBlobs, toWearableWithBlobs } from './utils';
import { type Props } from './types';

import './AssetPreview.css';

const WIDTH = 300;
const HEIGHT = 300;

const GIVE_UP_AFTER_MS = 30_000;

type PreviewState = 'loading' | 'ready' | 'failed';

/**
 * Reports a preview's outcome exactly once, with a thumbnail or without one.
 *
 * The import dialog gates its button on every model and image preview reporting back, so a
 * preview that can neither succeed nor fail leaves the dialog stuck with no error surfaced
 * anywhere — the failure mode of #694, #1456 and #1485. Both previews below can fail in ways
 * they cannot observe directly, a frame the browser refused to load reporting nothing at all,
 * so giving up after `GIVE_UP_AFTER_MS` is what makes reporting back unconditional rather than
 * best-effort. A failure `reason` can originate in the preview frame, so it is logged and never
 * rendered.
 *
 * `onScreenshot` is held in a ref so that `finish` — and with it the deadline — keeps a stable
 * identity no matter how often the caller re-renders with a fresh callback. A deadline that
 * restarts on every render is a deadline that never arrives.
 */
function usePreviewOutcome(onScreenshot: (thumbnail?: string) => void) {
  const [state, setState] = useState<PreviewState>('loading');
  const reported = useRef(false);
  const report = useRef(onScreenshot);
  report.current = onScreenshot;

  const finish = useCallback((thumbnail?: string, reason?: unknown) => {
    if (reported.current) return;
    reported.current = true;
    if (reason) console.error('Asset preview failed to render:', reason);
    report.current(thumbnail);
    setState(thumbnail ? 'ready' : 'failed');
  }, []);

  useEffect(() => {
    const giveUp = setTimeout(
      () => finish(undefined, `no preview after ${GIVE_UP_AFTER_MS}ms`),
      GIVE_UP_AFTER_MS,
    );
    return () => clearTimeout(giveUp);
  }, [finish]);

  return { state, finish };
}

export function AssetPreview({ value, resources, onScreenshot, onLoad, isEmote }: Props) {
  const preview = useMemo(() => {
    const ext = value.name.split('.').pop();
    switch (ext) {
      case 'gltf':
      case 'glb':
        return (
          <GltfPreview
            value={value}
            resources={resources}
            onScreenshot={onScreenshot}
            onLoad={onLoad}
            isEmote={isEmote}
          />
        );
      case 'png':
      case 'jpg':
      case 'jpeg':
        return (
          <PngPreview
            value={value}
            onScreenshot={onScreenshot}
            onLoad={onLoad}
          />
        );
      case 'mp3':
      case 'wav':
      case 'ogg':
        return <AudioIcon size="large" />;
      case 'mp4':
        return <VideoIcon size="large" />;
      case 'ts':
      case 'tsx':
        return <ScriptIcon size="large" />;
      default:
        return <OtherIcon size="large" />;
    }
  }, []);

  return <div className="assetPreview">{preview}</div>;
}

function GltfPreview({ value, resources, onScreenshot, onLoad, isEmote }: Props) {
  const { state, finish } = usePreviewOutcome(onScreenshot);

  const handleLoad = useCallback(async () => {
    onLoad?.();
    const wp = WearablePreview.createController(value.name);
    try {
      if (isEmote) {
        const middleOfEmote = (await wp.emote.getLength()) * 0.5;
        await wp.emote.goTo(middleOfEmote);
      }
      const screenshot = await wp.scene.getScreenshot(WIDTH, HEIGHT);
      setTimeout(() => finish(screenshot), 1000);
    } catch (error) {
      finish(undefined, error);
    }
  }, [onLoad, value, isEmote, finish]);

  const wearablePreviewExtraOptions = isEmote
    ? {
        profile: 'default',
        disableFace: true,
        disableDefaultWearables: true,
        skin: '000000',
        wheelZoom: 2,
      }
    : {};

  if (state === 'failed') return <OtherIcon size="large" />;

  return (
    <>
      <div>{state === 'loading' && <Loading dimmer={false} />}</div>
      <div className={cx('GltfPreview', { hidden: state === 'loading' })}>
        <WearablePreview
          id={value.name}
          blob={
            isEmote ? toEmoteWithBlobs(value, resources) : toWearableWithBlobs(value, resources)
          }
          disableAutoRotate
          disableBackground
          {...wearablePreviewExtraOptions}
          projection={PreviewProjection.ORTHOGRAPHIC}
          camera={PreviewCamera.STATIC}
          onLoad={handleLoad}
          onError={error => finish(undefined, error)}
        />
      </div>
    </>
  );
}

function PngPreview({ value, onScreenshot, onLoad }: Props) {
  const { state, finish } = usePreviewOutcome(onScreenshot);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const url = URL.createObjectURL(value);
  const img = new Image(WIDTH, HEIGHT);
  img.src = url;

  img.onerror = () => finish(undefined, `could not decode ${value.name}`);

  img.onload = () => {
    onLoad?.();
    const canvas = canvasRef.current;
    const ctx = canvasRef.current?.getContext('2d');
    const canvas2 = document.createElement('canvas');
    const ctx2 = canvas2.getContext('2d');

    if (canvas && ctx && ctx2) {
      canvas.height = canvas.width * (img.height / img.width);

      canvas2.width = img.width * 0.5;
      canvas2.height = img.height * 0.5;
      ctx2.drawImage(img, 0, 0, canvas2.width, canvas2.height);
      ctx2.drawImage(canvas2, 0, 0, canvas2.width * 0.5, canvas2.height * 0.5);
      ctx.drawImage(
        canvas2,
        0,
        0,
        canvas2.width * 0.5,
        canvas2.height * 0.5,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);

      finish(canvas.toDataURL('image/png'));

      canvas2.remove();
    }
  };

  if (state === 'failed') return <OtherIcon size="large" />;

  return (
    <>
      <div>{state === 'loading' && <Loading dimmer={false} />}</div>
      <canvas
        ref={canvasRef}
        id="asset-png-preview"
        touch-action="none"
        style={{ display: state === 'loading' ? 'none' : 'block' }}
      ></canvas>
    </>
  );
}
