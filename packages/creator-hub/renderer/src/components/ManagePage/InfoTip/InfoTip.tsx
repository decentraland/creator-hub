import {
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { InfoIcon, WarningCircleIcon } from '../../Icons';
import { Bubble, InfoButton, Peak, TipPopper, Wrapper } from './InfoTip.styled';

const CLOSE_GRACE_MS = 150;

type Variant = 'info' | 'warning';

const GLYPH: Record<Variant, ReactNode> = {
  info: <InfoIcon />,
  warning: <WarningCircleIcon size={18} />,
};

type Props = {
  label: string;
  variant?: Variant;
  size?: 'small' | 'medium';
  children: ReactNode;
};

/** A toggletip behind an ⓘ or ⚠ glyph: opens on hover, focus or click; Escape, click-away or leaving it closes it. */
export function InfoTip({ label, variant = 'info', size = 'medium', children }: Props) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const dismissed = useRef(false);
  const bubbleId = useId();

  const show = () => {
    clearTimeout(closeTimer.current);
    dismissed.current = false;
    setOpen(true);
  };
  const hide = () => {
    clearTimeout(closeTimer.current);
    setOpen(false);
  };

  const handleFocus = () => {
    if (!dismissed.current) show();
  };
  const handleBlur = (event: FocusEvent) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      dismissed.current = false;
      hide();
    }
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !open) return;
    event.stopPropagation();
    dismissed.current = true;
    hide();
    anchor?.focus();
  };

  return (
    <Wrapper
      onMouseEnter={show}
      onMouseLeave={() => {
        closeTimer.current = setTimeout(hide, CLOSE_GRACE_MS);
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <InfoButton
        ref={setAnchor}
        type="button"
        look={variant}
        size={size}
        aria-label={label}
        aria-expanded={open}
        aria-controls={bubbleId}
        onClick={show}
      >
        {GLYPH[variant]}
      </InfoButton>
      <TipPopper
        open={open}
        anchorEl={anchor}
        onClose={hide}
        placement="top"
        disablePortal
        role="presentation"
      >
        <Bubble
          id={bubbleId}
          onClick={event => {
            if ((event.target as HTMLElement).closest('a, button')) hide();
          }}
        >
          {children}
          <Peak />
        </Bubble>
      </TipPopper>
    </Wrapper>
  );
}
