import { describe, expect, it } from 'vitest';

import {
  allActionsHidden,
  defaultMobileHudConfig,
  isDefaultMobileHudConfig,
  MOBILE_ACTIONS,
  MOBILE_ACTION_LABELS,
  withAllActionsHidden,
} from './mobile-hud-config';

describe('when building the default MobileHUD config', () => {
  it('should have a button entry for every action, all shown with no icon', () => {
    const config = defaultMobileHudConfig();
    expect(Object.keys(config.buttons).sort()).toEqual([...MOBILE_ACTIONS].sort());
    for (const action of MOBILE_ACTIONS) {
      expect(config.buttons[action]).toEqual({ hide: false });
    }
    expect(config.mainAction).toBe('IA_JUMP');
    expect(config.hideJoystick).toBe(false);
    expect(config.hideCrosshair).toBe(false);
  });

  it('should label every action', () => {
    for (const action of MOBILE_ACTIONS) {
      expect(MOBILE_ACTION_LABELS[action]).toBeTruthy();
    }
  });
});

describe('when checking whether a MobileHUD config is default', () => {
  it('should treat the freshly built default as default', () => {
    expect(isDefaultMobileHudConfig(defaultMobileHudConfig())).toBe(true);
  });

  it('should treat any global toggle, a changed main action, a hidden button, or a custom icon as non-default', () => {
    const withJoystick = defaultMobileHudConfig();
    withJoystick.hideJoystick = true;
    expect(isDefaultMobileHudConfig(withJoystick)).toBe(false);

    const withMain = defaultMobileHudConfig();
    withMain.mainAction = 'IA_PRIMARY';
    expect(isDefaultMobileHudConfig(withMain)).toBe(false);

    const withHidden = defaultMobileHudConfig();
    withHidden.buttons.IA_POINTER.hide = true;
    expect(isDefaultMobileHudConfig(withHidden)).toBe(false);

    const withIcon = defaultMobileHudConfig();
    withIcon.buttons.IA_JUMP.icon = 'images/grab.png';
    expect(isDefaultMobileHudConfig(withIcon)).toBe(false);
  });
});

describe('when deriving the "Hide Input Actions" convenience', () => {
  it('should be checked only once every action button is hidden', () => {
    const config = defaultMobileHudConfig();
    expect(allActionsHidden(config)).toBe(false);

    const hidden = withAllActionsHidden(config, true);
    expect(allActionsHidden(hidden)).toBe(true);
    expect(MOBILE_ACTIONS.every(a => hidden.buttons[a].hide)).toBe(true);

    expect(allActionsHidden(withAllActionsHidden(hidden, false))).toBe(false);
  });

  it('should preserve custom icons when toggling visibility', () => {
    const config = defaultMobileHudConfig();
    config.buttons.IA_JUMP.icon = 'images/grab.png';
    expect(withAllActionsHidden(config, true).buttons.IA_JUMP.icon).toBe('images/grab.png');
  });
});
