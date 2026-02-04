import React, { useState, useCallback, useRef, useEffect } from 'react';
import cx from 'classnames';
import { Popper } from 'decentraland-ui2';
import { misc } from '#preload';
import { t } from '/@/modules/store/translation/utils';
import './styles.css';

type Props = {
  text: string;
  children: React.ReactNode;
  showPopup?: boolean;
  className?: string;
  timeOut?: number;
  onCopy?: () => void;
};

const CopyToClipboard: React.FC<Props> = React.memo(
  ({ text, showPopup = false, timeOut = 3000, onCopy, className, children }) => {
    const [hasCopiedText, setHasCopiedText] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);
    const anchorRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleTransitionEnd = useCallback(() => {
      if (showPopup) {
        setHasCopiedText(false);
        setFadeOut(false);
      }
    }, [showPopup]);

    const handleCopy = useCallback(async () => {
      await misc.copyToClipboard(text);
      if (onCopy) onCopy();
      if (showPopup) {
        setHasCopiedText(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setFadeOut(true);
          timeoutRef.current = null;
        }, timeOut);
      }
    }, [text, showPopup, timeOut, onCopy]);

    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    return (
      <>
        <div
          className={className}
          role="button"
          aria-label="copy"
          onClick={handleCopy}
          ref={anchorRef}
        >
          {children}
        </div>
        <Popper
          className={cx('CopyToClipboardPopup', { FadeOut: fadeOut })}
          onTransitionEnd={handleTransitionEnd}
          open={hasCopiedText}
          placement="right"
          anchorEl={anchorRef.current}
        >
          {t('popup.copied_to_clipboard')}
        </Popper>
      </>
    );
  },
);

export { CopyToClipboard };
