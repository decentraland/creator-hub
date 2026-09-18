import type { BrowserWindow } from 'electron';
import type { JSHandle } from 'playwright';
import { expect, test } from '../fixtures';

/**
 * Smoke coverage that the packaged app boots into a healthy window. These two tests are
 * independent, so each takes a fresh app instance from the fixture.
 */
test.describe('app window', { tag: '@offline' }, () => {
  test('opens a visible, uncrashed main window', async ({ electronApp, page }) => {
    const window: JSHandle<BrowserWindow> = await electronApp.browserWindow(page);
    const windowState = await window.evaluate(
      (
        mainWindow,
      ): Promise<{ isVisible: boolean; isDevToolsOpened: boolean; isCrashed: boolean }> => {
        const getState = () => ({
          isVisible: mainWindow.isVisible(),
          isDevToolsOpened: mainWindow.webContents.isDevToolsOpened(),
          isCrashed: mainWindow.webContents.isCrashed(),
        });

        return new Promise(resolve => {
          /**
           * The main window is created hidden and shown only when it is ready.
           * See `main/src/mainWindow.ts`.
           */
          if (mainWindow.isVisible()) {
            resolve(getState());
          } else mainWindow.once('ready-to-show', () => resolve(getState()));
        });
      },
    );

    expect(windowState.isCrashed, 'The app has crashed').toBeFalsy();
    expect(windowState.isVisible, 'The main window was not visible').toBeTruthy();
    expect(windowState.isDevToolsOpened, 'The DevTools panel was open').toBeFalsy();
  });

  test('renders content into the root element', async ({ page }) => {
    // The `page` fixture already waited for `#app main.Main` to be visible.
    const element = await page.$('#app', { strict: true });
    expect(element, 'Was unable to find the root element').toBeTruthy();
    expect((await element!.innerHTML()).trim(), 'Window content was empty').not.toEqual('');
  });
});
