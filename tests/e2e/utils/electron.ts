import path from 'path';
import { rm } from 'fs/promises';
import type { ElectronApplication, Page } from 'playwright';
import { _electron as electron } from 'playwright';
import dotenv from 'dotenv';
import { log } from './logger';

dotenv.config({ path: '.env.e2e' });

export class ElectronUtils {
  private electronApp: ElectronApplication | null = null;
  private page: Page | null = null;

  async getPage(): Promise<Page> {
    if (!this.electronApp) {
      await this.launchElectron();
    }

    if (!this.page) {
      if (!this.electronApp) {
        throw new Error('Electron app not initialized');
      }
      this.page = await this.electronApp.firstWindow();
      await this.waitForAppReady();
      await this.clearStorageSafely(this.page);
    }

    return this.page;
  }

  async getApp(): Promise<ElectronApplication> {
    if (!this.electronApp) {
      await this.launchElectron();
    }
    if (!this.electronApp) {
      throw new Error('Failed to launch Electron app');
    }
    return this.electronApp;
  }

  async cleanup(): Promise<void> {
    if (this.electronApp) {
      await this.electronApp.close();
      this.electronApp = null;
      this.page = null;
    }
  }

  private async launchElectron(): Promise<void> {
    // Use the specific paths that the main app expects in E2E mode
    const userDataPath = path.resolve('./tests/temp/userData');
    const homePath = path.resolve('./tests/temp/home');

    // Clean up any existing singleton lock
    await this.cleanupSingletonLock(userDataPath);

    this.electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        PORT: '3001',
        USER_DATA_PATH: userDataPath,
        HOME_PATH: homePath,
      },
    });
  }

  async waitForAppReady(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized. Call getPage() first.');
    }

    // Wait for the app to be ready
    await this.page.waitForSelector('#app', { state: 'visible' });

    // Additional wait to ensure the app is fully loaded
    await this.page.waitForLoadState('domcontentloaded');

    // Wait for React Router to be ready
    await this.page.waitForLoadState('networkidle');
  }

  // Simple storage clearing that's less likely to cause issues
  private async clearStorageSafely(page: Page): Promise<void> {
    try {
      // Wait for the page to be ready
      await page.waitForLoadState('domcontentloaded');

      // Only clear cookies, which is usually safe
      await page.context().clearCookies();

      log.info('Cleared cookies safely');
    } catch (error) {
      log.warn('Could not clear cookies:', error);
    }
  }

  // Method to reset page state between tests
  async resetPageState(): Promise<void> {
    if (this.page) {
      try {
        // Clear any mock auth state
        await this.page.evaluate(() => {
          if ((window as any).__mockAuthState) {
            (window as any).__mockAuthState = { isAuthenticated: false, account: null };
          }
        });

        // Clear cookies
        await this.page.context().clearCookies();

        log.info('Reset page state');
      } catch (error) {
        log.warn('Could not reset page state:', error);
      }
    }
  }

  // Helper method to cleanup singleton lock
  private async cleanupSingletonLock(userDataPath: string): Promise<void> {
    try {
      const singletonLockPath = path.join(userDataPath, 'SingletonLock');
      await rm(singletonLockPath, { force: true });
      log.info('Cleaned up singleton lock');
    } catch (error) {
      // Singleton lock doesn't exist, which is fine
    }
  }

  // Static method for backward compatibility (deprecated)
  static async resetGlobalInstance(): Promise<void> {
    log.warn('resetGlobalInstance is deprecated. Use instance-based approach instead.');
  }
}
