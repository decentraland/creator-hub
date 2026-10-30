import { type Page } from 'playwright';
import { App } from './pageObjects/App';
import { UIDesigner } from './pageObjects/UIDesigner';

declare const page: Page;
declare const __e2eNavUrl: string;

const CONFIGURABLE_KINDS = [
  'joystick',
  'crosshair',
  'jump',
  'pointer',
  'keyE',
  'keyF',
  'action1',
  'action2',
  'action3',
  'action4',
];

const ROOT = 'MainUI';

const joystickGuide = () => page.locator(`${UIDesigner.hudGuideSelector}[data-kind="joystick"]`);

describe('UI Designer MobileHUD', () => {
  beforeAll(async () => {
    await page.goto(`${__e2eNavUrl}&uiEditorEnabled=true&uiEditorSupported=true`, {
      timeout: 90_000,
    });
    await App.waitUntilReady();
    await UIDesigner.open();
  });

  test('offer no MobileHUD row until the scene has a GUI', async () => {
    await expect(UIDesigner.isMobileHudRowVisible()).resolves.toBe(false);
  });

  test('surface the MobileHUD row once a GUI exists', async () => {
    await UIDesigner.createRootFromEmptyState();

    await expect(UIDesigner.isMobileHudRowVisible()).resolves.toBe(true);
  });

  test('open a read-only preview with every touch button and a crosshair when selected', async () => {
    await UIDesigner.selectMobileHud();

    await expect(UIDesigner.isMobileHudPanelVisible()).resolves.toBe(true);
    await expect(UIDesigner.activeRootCount()).resolves.toBe(0);
    await expect(UIDesigner.enabledPaletteCount()).resolves.toBe(0);
    const kinds = await UIDesigner.hudGuideKinds();
    for (const kind of CONFIGURABLE_KINDS) {
      expect(kinds).toContain(kind);
    }
  });

  test('hide the device variant switch and canvas tools while MobileHUD is selected', async () => {
    await expect(UIDesigner.isDeviceToggleHidden()).resolves.toBe(true);
  });

  test('default the main action to IA_JUMP', async () => {
    await expect(UIDesigner.mainAction()).resolves.toBe('IA_JUMP');
  });

  test('drop the joystick from the preview when Hide Joystick is checked', async () => {
    await UIDesigner.toggleHudGlobal('Hide Joystick');

    await expect(UIDesigner.isHudGlobalChecked('Hide Joystick')).resolves.toBe(true);
    await joystickGuide().waitFor({ state: 'detached', timeout: 10_000 });
  });

  test('move the main action to the chosen button, reflected as the big canvas button', async () => {
    await UIDesigner.setMainAction('IA_PRIMARY');

    await expect(UIDesigner.mainAction()).resolves.toBe('IA_PRIMARY');
    await expect(UIDesigner.canvasMainAction()).resolves.toBe('IA_PRIMARY');
  });

  test('restore the joystick when Hide Joystick is cleared', async () => {
    await UIDesigner.setMainAction('IA_JUMP');
    await UIDesigner.toggleHudGlobal('Hide Joystick');

    await expect(UIDesigner.isHudGlobalChecked('Hide Joystick')).resolves.toBe(false);
    await joystickGuide().waitFor({ state: 'attached', timeout: 10_000 });
  });

  test('re-pack the remaining buttons and drop the + when actions are hidden', async () => {
    for (const action of ['IA_PRIMARY', 'IA_SECONDARY', 'IA_ACTION_4']) {
      await UIDesigner.toggleActionHidden(action);
    }
    await page
      .locator(`${UIDesigner.hudGuideSelector}[data-kind="keyE"]`)
      .waitFor({ state: 'detached', timeout: 10_000 });

    const kinds = await UIDesigner.hudGuideKinds();
    expect(kinds).not.toContain('keyF');
    expect(kinds).not.toContain('action2');
    expect(kinds).not.toContain('plus');
    expect(kinds).toEqual(expect.arrayContaining(['pointer', 'action1', 'action3', 'action4']));

    for (const action of ['IA_PRIMARY', 'IA_SECONDARY', 'IA_ACTION_4']) {
      await UIDesigner.toggleActionHidden(action);
    }
  });

  test('re-select the empty GUI from MobileHUD (no nodes to fall back on)', async () => {
    await UIDesigner.selectMobileHud();
    await expect(UIDesigner.isMobileHudPanelVisible()).resolves.toBe(true);

    await UIDesigner.selectRoot(ROOT);

    await page
      .locator(UIDesigner.mobileHudPanelSelector)
      .waitFor({ state: 'detached', timeout: 10_000 });
    await expect(UIDesigner.isRootActive(ROOT)).resolves.toBe(true);
  });
});
