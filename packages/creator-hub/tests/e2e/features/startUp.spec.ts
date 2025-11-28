import type { JSHandle } from 'playwright';
import { test, expect } from '@playwright/test';

import { ElectronUtils } from '../utils/electron';
import { TempDirManager } from '../utils/tempDirManager';

test.describe('Application startup', () => {
  test.beforeEach(async () => {
    // Clean up and recreate temp directory before each test
    await TempDirManager.cleanupAndRecreate();
  });

  test.afterEach(async () => {
    // Clean up temp directory after each test
    await TempDirManager.cleanup();
  });

  test('Main window state', async () => {
    const electronUtils = new ElectronUtils();

    try {
      const page = await electronUtils.getPage();
      const app = await electronUtils.getApp();
      const window: JSHandle<any> = await app.browserWindow(page);
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
             * The main window is created hidden, and is shown only when it is ready.
             * See {@link ../../../packages/main/src/mainWindow.ts} function
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
    } finally {
      await electronUtils.cleanup();
    }
  });

  test('Main window web content', async () => {
    const electronUtils = new ElectronUtils();

    try {
      const page = await electronUtils.getPage();
      // The page is already ready from getPage(), just verify content
      const element = await page.$('#app', { strict: true });
      expect(element, 'Was unable to find the root element').toBeDefined();
      expect((await element!.innerHTML()).trim(), 'Window content was empty').not.toEqual('');
    } finally {
      await electronUtils.cleanup();
    }
  });
});
