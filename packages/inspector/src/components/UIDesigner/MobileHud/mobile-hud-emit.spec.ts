import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { applyEdits } from '../code/emit-adapter';
import { defaultMobileHudConfig, type MobileHudConfig } from './mobile-hud-config';
import {
  generateMobileHudModule,
  MOBILE_HUD_MODULE,
  parseMobileHudConfig,
  unwireMobileHudEdits,
  wireMobileHudEdits,
} from './mobile-hud-emit';

const roundTrip = (config: MobileHudConfig): MobileHudConfig => {
  const source = generateMobileHudModule(config);
  const parsed = parseSync(MOBILE_HUD_MODULE, source);
  expect(parsed.errors).toHaveLength(0);
  return parseMobileHudConfig(parsed.program, source);
};

describe('when generating the MobileHUD module', () => {
  it('should be valid TS that sets up TouchScreenControls on the root entity', () => {
    const config = defaultMobileHudConfig();
    config.hideJoystick = true;
    const source = generateMobileHudModule(config);

    expect(source).toContain("from '@dcl/sdk/ecs'");
    expect(source).toContain('TouchScreenControls.createOrReplace(engine.RootEntity');
    expect(source).toContain('export function setupMobileHud()');
    expect(source).toContain('hideJoystick: true');
    expect(parseSync(MOBILE_HUD_MODULE, source).errors).toHaveLength(0);
  });

  it('should emit InputAction members unquoted and a custom icon as a scene texture', () => {
    const config = defaultMobileHudConfig();
    config.mainAction = 'IA_PRIMARY';
    config.buttons.IA_JUMP.icon = 'images/grab.png';
    const source = generateMobileHudModule(config);

    expect(source).toContain('mainAction: InputAction.IA_PRIMARY');
    expect(source).toContain('inputAction: InputAction.IA_JUMP');
    expect(source).toContain("texture: { src: 'images/grab.png' }");
    expect(source).toContain("$case: 'texture'");
  });

  it('should always emit the required `hide` field, even for an icon-only override', () => {
    const config = defaultMobileHudConfig();
    config.buttons.IA_JUMP.icon = 'images/grab.png';
    const source = generateMobileHudModule(config);

    expect(source).toContain('inputAction: InputAction.IA_JUMP, hide: false');
  });

  it('should always emit the required hideJoystick, hideCrosshair, and touchInputs fields', () => {
    const source = generateMobileHudModule(defaultMobileHudConfig());

    expect(source).toContain('hideJoystick: false');
    expect(source).toContain('hideCrosshair: false');
    expect(source).toContain('touchInputs: []');
    expect(parseSync(MOBILE_HUD_MODULE, source).errors).toHaveLength(0);
  });
});

describe('when round-tripping a MobileHUD config through generate + parse', () => {
  it('should preserve global toggles, main action, per-button hide, and custom icons', () => {
    const config = defaultMobileHudConfig();
    config.hideJoystick = true;
    config.hideCrosshair = true;
    config.mainAction = 'IA_SECONDARY';
    config.buttons.IA_POINTER.hide = true;
    config.buttons.IA_ACTION_3.icon = 'images/one.png';

    expect(roundTrip(config)).toEqual(config);
  });

  it('should read an untouched module back as the default config', () => {
    expect(roundTrip(defaultMobileHudConfig())).toEqual(defaultMobileHudConfig());
  });

  it('should fall back to defaults when the source has no TouchScreenControls call', () => {
    const source = 'export function main() {}';
    const parsed = parseSync('src/index.ts', source);
    expect(parseMobileHudConfig(parsed.program, source)).toEqual(defaultMobileHudConfig());
  });
});

describe('when wiring the MobileHUD module into the scene entry', () => {
  const parse = (source: string) => parseSync('src/index.ts', source).program;

  it('should add the import and call once, and be idempotent', () => {
    const before = "import { setupUi } from './ui'\n\nexport function main() {\n  setupUi()\n}\n";
    const wired = applyEdits(before, wireMobileHudEdits(parse(before), before));

    expect(wired).toContain("import { setupMobileHud } from './mobile-hud'");
    expect(wired.match(/setupMobileHud\(\)/g)).toHaveLength(1);
    expect(parseSync('src/index.ts', wired).errors).toHaveLength(0);

    const again = applyEdits(wired, wireMobileHudEdits(parse(wired), wired));
    expect(again).toBe(wired);
  });

  it('should strip the import and call on unwire', () => {
    const before = "import { setupUi } from './ui'\n\nexport function main() {\n  setupUi()\n}\n";
    const wired = applyEdits(before, wireMobileHudEdits(parse(before), before));
    const unwired = applyEdits(wired, unwireMobileHudEdits(parse(wired), wired));

    expect(unwired).not.toContain('setupMobileHud');
    expect(parseSync('src/index.ts', unwired).errors).toHaveLength(0);
  });
});
