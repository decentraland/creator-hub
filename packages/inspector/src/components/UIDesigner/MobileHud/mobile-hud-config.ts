/**
 * MobileHUD: the editable model for a scene's `TouchScreenControls`.
 *
 * MobileHUD is not a react-ecs UI root — it is a `TouchScreenControls`
 * setup call written to `src/mobile-hud.ts` (outside `src/ui/`). This module
 * holds the ergonomic config the panel/canvas edit; emit/parse and persistence
 * live in `mobile-hud-emit.ts` / `mobile-hud-store.ts`.
 *
 * @module
 */

/** The `InputAction`s that map to on-screen touch buttons, in panel/display order. */
export const MOBILE_ACTIONS = [
  'IA_JUMP',
  'IA_POINTER',
  'IA_PRIMARY',
  'IA_SECONDARY',
  'IA_ACTION_3',
  'IA_ACTION_4',
  'IA_ACTION_5',
  'IA_ACTION_6',
] as const;

export type MobileAction = (typeof MOBILE_ACTIONS)[number];

/** Human labels, mirroring the on-device key each action shows. */
export const MOBILE_ACTION_LABELS: Record<MobileAction, string> = {
  IA_JUMP: 'IA_JUMP',
  IA_POINTER: 'IA_POINTER',
  IA_PRIMARY: 'IA_PRIMARY (E)',
  IA_SECONDARY: 'IA_SECONDARY (F)',
  IA_ACTION_3: 'IA_ACTION_3 (1)',
  IA_ACTION_4: 'IA_ACTION_4 (2)',
  IA_ACTION_5: 'IA_ACTION_5 (3)',
  IA_ACTION_6: 'IA_ACTION_6 (4)',
};

export interface MobileButtonConfig {
  hide: boolean;
  /** Scene image path (e.g. `images/grab.png`), or undefined for the default glyph. */
  icon?: string;
}

export interface MobileHudConfig {
  hideJoystick: boolean;
  hideCrosshair: boolean;
  mainAction: MobileAction;
  buttons: Record<MobileAction, MobileButtonConfig>;
}

export const DEFAULT_MAIN_ACTION: MobileAction = 'IA_JUMP';

export function defaultMobileHudConfig(): MobileHudConfig {
  const buttons = {} as Record<MobileAction, MobileButtonConfig>;
  for (const action of MOBILE_ACTIONS) buttons[action] = { hide: false };
  return {
    hideJoystick: false,
    hideCrosshair: false,
    mainAction: DEFAULT_MAIN_ACTION,
    buttons,
  };
}

/** True when nothing deviates from SDK defaults — drives lazy write / auto-clean. */
export function isDefaultMobileHudConfig(config: MobileHudConfig): boolean {
  if (config.hideJoystick || config.hideCrosshair) return false;
  if (config.mainAction !== DEFAULT_MAIN_ACTION) return false;
  return MOBILE_ACTIONS.every(action => {
    const button = config.buttons[action];
    return !button.hide && button.icon === undefined;
  });
}

/** The "Hide Input Actions" convenience: checked iff every action button is hidden. */
export function allActionsHidden(config: MobileHudConfig): boolean {
  return MOBILE_ACTIONS.every(action => config.buttons[action].hide);
}

/** Set every action button's visibility (backs the "Hide Input Actions" toggle). */
export function withAllActionsHidden(config: MobileHudConfig, hide: boolean): MobileHudConfig {
  const buttons = {} as Record<MobileAction, MobileButtonConfig>;
  for (const action of MOBILE_ACTIONS) buttons[action] = { ...config.buttons[action], hide };
  return { ...config, buttons };
}
