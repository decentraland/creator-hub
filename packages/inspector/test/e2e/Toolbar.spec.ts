import { type Page } from 'playwright';
import { App } from './pageObjects/App';
import { UIDesigner } from './pageObjects/UIDesigner';

declare const page: Page;

const SNOW_RING = 'solid 2px rgb(252, 252, 252)';
const EDIT_SCENE = '.Toolbar:not(.ui-designer-toolbar) .ToolbarButton.edit-scene';
const SNAP = '.Toolbar:not(.ui-designer-toolbar) .ToolbarButton.snap';

const focused = () =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const style = getComputedStyle(el);
    return {
      name: el.getAttribute('aria-label') ?? el.getAttribute('title'),
      label: el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : undefined,
      expanded: el.getAttribute('aria-expanded'),
      focusVisible: el.matches(':focus-visible'),
      outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
    };
  });

const panelOpen = () =>
  page.locator('.Toolbar:not(.ui-designer-toolbar) .Gizmos .panel.visible').count();

async function focusByKeyboard(selector: string) {
  await page.locator(selector).focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
}

describe('3D toolbar keyboard focus', () => {
  beforeAll(async () => {
    await App.waitUntilReady();
  });

  test('draw the Snow ring on a 3D toolbar button reached by Tab', async () => {
    await focusByKeyboard(EDIT_SCENE);

    await expect(focused()).resolves.toMatchObject({
      name: 'Edit Scene',
      focusVisible: true,
      outline: SNOW_RING,
    });
  });

  test('reach the snap increments by keyboard with Snap off', async () => {
    if ((await page.locator(SNAP).getAttribute('aria-pressed')) === 'true') {
      await page.locator(SNAP).click();
    }
    await focusByKeyboard(SNAP);
    await expect(focused()).resolves.toMatchObject({ name: 'Snap', outline: SNOW_RING });

    await page.keyboard.press('Tab');
    await expect(focused()).resolves.toMatchObject({
      name: 'Snap increments',
      expanded: 'false',
      outline: SNOW_RING,
    });

    await page.keyboard.press('Enter');
    await expect(focused()).resolves.toMatchObject({ name: 'Snap increments', expanded: 'true' });

    await page.keyboard.press('Escape');
    await expect(focused()).resolves.toMatchObject({ name: 'Snap increments', expanded: 'false' });
    await expect(panelOpen()).resolves.toBe(0);

    await page.keyboard.press('Enter');

    await page.keyboard.press('Tab');
    await expect(focused()).resolves.toMatchObject({
      label: 'Position',
      focusVisible: true,
      outline: SNOW_RING,
    });

    await page.keyboard.press('Escape');
    await expect(focused()).resolves.toMatchObject({ name: 'Snap increments', expanded: 'false' });
    await expect(panelOpen()).resolves.toBe(0);
  });

  test('keep Align to World across a 2D round trip', async () => {
    const chevron = page.locator('.Toolbar:not(.ui-designer-toolbar) .snap-menu');
    const align = () => page.getByRole('checkbox', { name: 'Align to World' });
    await chevron.click();
    if (!(await align().isChecked())) await align().click();
    await expect(align().isChecked()).resolves.toBe(true);
    await chevron.click();

    await UIDesigner.open();
    await page.locator('[role="tab"]', { hasText: '3D' }).first().click();
    await chevron.waitFor({ state: 'visible', timeout: 10_000 });

    await chevron.click();
    await expect(align().isChecked()).resolves.toBe(true);
    await chevron.click();
  });
});
