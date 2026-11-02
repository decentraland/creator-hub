import React from 'react';
import cx from 'classnames';

import { useAssetUrl } from '../../../../hooks/useAssetUrl';
import { useAppSelector } from '../../../../redux/hooks';
import { getMobileHudHighlight } from '../../../../redux/ui-designer';
import type { MobileAction, MobileHudConfig } from '../../MobileHud/mobile-hud-config';
import { MOBILE_ACTIONS } from '../../MobileHud/mobile-hud-config';
import type { HudKind } from '../../shared/safe-areas';
import { SAFE_AREAS } from '../../shared/safe-areas';
import { HudIcon } from '../SafeAreaOverlay/hud-icons';

import '../SafeAreaOverlay/SafeAreaOverlay.css';
import './MobileHudPreview.css';

interface Slot {
  kind: HudKind;
  /** Center as a fraction of the safe-area box. */
  x: number;
  y: number;
  /** Diameter as a fraction of the box's smaller side. */
  size: number;
}

/** Home slot per action in box coordinates; sizes are Figma px over the box's smaller side (≈633px). */
const HOME: Record<MobileAction, Slot> = {
  IA_JUMP: { kind: 'jump', x: 0.943, y: 0.863, size: 0.2525 },
  IA_POINTER: { kind: 'pointer', x: 0.824, y: 0.932, size: 0.1263 },
  IA_PRIMARY: { kind: 'keyE', x: 0.831, y: 0.76, size: 0.1263 },
  IA_SECONDARY: { kind: 'keyF', x: 0.893, y: 0.626, size: 0.1263 },
  IA_ACTION_3: { kind: 'action1', x: 0.971, y: 0.471, size: 0.1263 },
  IA_ACTION_4: { kind: 'action2', x: 0.971, y: 0.335, size: 0.1263 },
  IA_ACTION_5: { kind: 'action3', x: 0.971, y: 0.199, size: 0.1263 },
  IA_ACTION_6: { kind: 'action4', x: 0.971, y: 0.063, size: 0.1263 },
};

const JOYSTICK: Slot = { kind: 'joystick', x: 0.1, y: 0.76, size: 0.2715 };
const CROSSHAIR: Slot = { kind: 'crosshair', x: 0.5, y: 0.5, size: 0.08 };
const PLUS: Slot = { kind: 'plus', x: 0.971, y: 0.607, size: 0.1263 };

/** Non-configurable client chrome, shown only in the editing reference (profile/chat top-left, emote bottom-left). */
const CHROME: Slot[] = [
  { kind: 'profile', x: 0.035, y: 0.075, size: 0.11 },
  { kind: 'chat', x: 0.12, y: 0.075, size: 0.09 },
  { kind: 'emote', x: 0.035, y: 0.93, size: 0.11 },
];

const Guide: React.FC<{
  kind: HudKind;
  slot: Slot;
  boxW: number;
  boxH: number;
  boxMin: number;
  action?: MobileAction;
  icon?: string;
  main?: boolean;
  highlighted?: boolean;
}> = ({ kind, slot, boxW, boxH, boxMin, action, icon, main, highlighted }) => {
  const iconUrl = useAssetUrl(icon);
  const d = slot.size * boxMin;
  const style: React.CSSProperties = {
    left: slot.x * boxW - d / 2,
    top: slot.y * boxH - d / 2,
    width: d,
    height: d,
  };
  if (iconUrl) {
    style.backgroundImage = `url(${iconUrl})`;
    style.backgroundSize = 'contain';
    style.backgroundRepeat = 'no-repeat';
    style.backgroundPosition = 'center';
  }
  return (
    <div
      className={cx('ui-designer-hud-guide', 'ui-designer-mobile-hud-guide', {
        'is-main': main,
        'is-highlighted': highlighted,
      })}
      data-kind={kind}
      data-action={action}
      data-main={main ? 'true' : undefined}
      style={style}
    >
      {iconUrl ? null : <HudIcon kind={kind} />}
    </div>
  );
};

/** Read-only mobile-controls view from the config; `reference` adds client chrome and drops it below the nodes. */
export const MobileHudPreview: React.FC<{
  width: number;
  height: number;
  config: MobileHudConfig;
  reference?: boolean;
}> = ({ width, height, config, reference }) => {
  const highlight = useAppSelector(getMobileHudHighlight);
  const area = SAFE_AREAS.mobile.screenInsetArea;
  const boxLeft = area.x[0] * width;
  const boxTop = area.y[0] * height;
  const boxW = (area.x[1] - area.x[0]) * width;
  const boxH = (area.y[1] - area.y[0]) * height;
  const boxMin = Math.min(boxW, boxH);

  const main = config.mainAction;
  const visible = [main, ...MOBILE_ACTIONS.filter(action => action !== main)].filter(
    action => !config.buttons[action].hide,
  );
  const slotFor = (action: MobileAction): Slot => HOME[MOBILE_ACTIONS[visible.indexOf(action)]];
  const showPlus = visible.length > 5;

  const box = { boxW, boxH, boxMin };

  return (
    <div
      className={cx('ui-designer-safe-area ui-designer-mobile-hud-preview', {
        'ui-designer-mobile-hud-preview--reference': reference,
      })}
      style={{ left: boxLeft, top: boxTop, width: boxW, height: boxH }}
      aria-hidden="true"
    >
      {reference
        ? CHROME.map(slot => (
            <Guide
              key={slot.kind}
              kind={slot.kind}
              slot={slot}
              {...box}
            />
          ))
        : null}
      {!config.hideJoystick ? (
        <Guide
          kind={JOYSTICK.kind}
          slot={JOYSTICK}
          {...box}
        />
      ) : null}
      {!config.hideCrosshair ? (
        <Guide
          kind={CROSSHAIR.kind}
          slot={CROSSHAIR}
          {...box}
        />
      ) : null}
      {showPlus ? (
        <Guide
          kind={PLUS.kind}
          slot={PLUS}
          {...box}
        />
      ) : null}
      {MOBILE_ACTIONS.map(action => {
        const button = config.buttons[action];
        if (button.hide) return null;
        return (
          <Guide
            key={action}
            kind={HOME[action].kind}
            slot={slotFor(action)}
            {...box}
            action={action}
            icon={button.icon}
            main={action === main}
            highlighted={highlight === action}
          />
        );
      })}
    </div>
  );
};

export default MobileHudPreview;
