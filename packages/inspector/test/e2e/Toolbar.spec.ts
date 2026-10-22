import { type Page } from 'playwright';
import { App } from './pageObjects/App';

declare const page: Page;

const SNOW_RING = 'solid 2px rgb(252, 252, 252)';
const PREFERENCES = '.Toolbar:not(.ui-designer-toolbar) .ToolbarButton.preferences';

const focused = () =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const style = getComputedStyle(el);
    return {
      name: el.getAttribute('aria-label') ?? el.getAttribute('title'),
      isSnapInput: el.matches('.Snap > input'),
      focusVisible: el.matches(':focus-visible'),
      outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
    };
  });

async function focusPreferencesByKeyboard() {
  const preferences = page.locator(PREFERENCES);
  await preferences.click();
  await preferences.click();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
}

describe('3D toolbar keyboard focus', () => {
  beforeAll(async () => {
    await App.waitUntilReady();
  });

  test('draw the Snow ring on a 3D toolbar button reached by Tab', async () => {
    await focusPreferencesByKeyboard();

    await expect(focused()).resolves.toEqual({
      name: 'Preferences',
      isSnapInput: false,
      focusVisible: true,
      outline: SNOW_RING,
    });
  });

  test('reach the snap caret by keyboard and draw the ring on a focused Snap input', async () => {
    await focusPreferencesByKeyboard();
    await page.keyboard.press('Shift+Tab');

    await expect(focused()).resolves.toMatchObject({ name: 'Snap options', outline: SNOW_RING });

    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');

    await expect(focused()).resolves.toMatchObject({
      isSnapInput: true,
      focusVisible: true,
      outline: SNOW_RING,
    });
  });
});
