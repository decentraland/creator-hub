import { useCallback, useEffect, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { Button, IconButton } from 'decentraland-ui2';
import { misc } from '#preload';

import './styles.css';

export type PromoBannerConfig = {
  backgroundVideo?: string;
  promoImage?: string;
  href: string;
  ctaLabel: string;
  videoDuration?: number;
  promoDuration?: number;
};

type PromoBannerProps = {
  config: PromoBannerConfig;
  onDismiss: () => void;
};

type Phase =
  | 'video'
  | 'slide-to-image'
  | 'image-reset'
  | 'image'
  | 'slide-to-video'
  | 'video-reset';

function getSlideClass(position: 'center' | 'left' | 'right', noTransition?: boolean) {
  const classes: string[] = ['PromoBannerSlide'];
  if (position === 'left') classes.push('at-left');
  if (position === 'right') classes.push('at-right');
  if (noTransition) classes.push('no-transition');
  return classes.join(' ');
}

function getVideoSlideClass(phase: Phase) {
  switch (phase) {
    case 'video':
    case 'video-reset':
      return getSlideClass('center');
    case 'slide-to-image':
      return getSlideClass('left');
    case 'image-reset':
      return getSlideClass('right', true);
    case 'image':
      return getSlideClass('right');
    case 'slide-to-video':
      return getSlideClass('center');
  }
}

function getImageSlideClass(phase: Phase) {
  switch (phase) {
    case 'video':
      return getSlideClass('right');
    case 'slide-to-image':
    case 'image-reset':
    case 'image':
      return getSlideClass('center');
    case 'slide-to-video':
      return getSlideClass('left');
    case 'video-reset':
      return getSlideClass('right', true);
  }
}

export function PromoBanner({ config, onDismiss }: PromoBannerProps) {
  const [phase, setPhase] = useState<Phase>('video');
  const [ctaVisible, setCTaVisible] = useState(false);

  const isImagePhase = phase === 'image' || phase === 'image-reset' || phase === 'slide-to-video';

  const handleClick = useCallback(() => {
    misc.openExternal(config.href);
  }, [config.href]);

  useEffect(() => {
    if (!config.backgroundVideo || !config.promoImage) {
      setCTaVisible(true);
      return;
    }

    const videoDur = (config.videoDuration ?? 8) * 1000;
    const promoDur = (config.promoDuration ?? 6) * 1000;
    const slideDur = 800;
    const resetDelay = 50;
    const timers: ReturnType<typeof setTimeout>[] = [];

    function runCycle() {
      let t = 0;

      t += videoDur;
      timers.push(setTimeout(() => setPhase('slide-to-image'), t));

      t += slideDur;
      timers.push(setTimeout(() => setPhase('image-reset'), t));

      t += resetDelay;
      timers.push(setTimeout(() => setPhase('image'), t));
      timers.push(setTimeout(() => setCTaVisible(true), t + 200));

      t += promoDur;
      timers.push(setTimeout(() => setCTaVisible(false), t));

      t += 400;
      timers.push(setTimeout(() => setPhase('slide-to-video'), t));

      t += slideDur;
      timers.push(setTimeout(() => setPhase('video-reset'), t));

      t += resetDelay;
      timers.push(setTimeout(() => setPhase('video'), t));

      t += 50;
      timers.push(setTimeout(runCycle, t));
    }

    setPhase('video');
    runCycle();

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [config.backgroundVideo, config.promoImage, config.videoDuration, config.promoDuration]);

  return (
    <div className="PromoBanner">
      {config.backgroundVideo && (
        <div className={getVideoSlideClass(phase)}>
          <video
            className="PromoBannerVideo"
            src={config.backgroundVideo}
            autoPlay
            loop
            muted
            playsInline
          />
        </div>
      )}

      {config.promoImage && (
        <div className={getImageSlideClass(phase)}>
          <img
            className="PromoBannerPromo"
            src={config.promoImage}
            alt=""
          />
          <Button
            className={`PromoBannerCta ${ctaVisible ? 'visible' : ''}`}
            variant="contained"
            size="small"
            onClick={handleClick}
          >
            {config.ctaLabel}
          </Button>
        </div>
      )}

      <div className={`PromoBannerOverlay ${isImagePhase ? 'promo' : ''}`} />

      <IconButton
        className="PromoBannerClose"
        size="small"
        onClick={onDismiss}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </div>
  );
}
