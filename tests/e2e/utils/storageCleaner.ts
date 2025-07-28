import { rm, access } from 'fs/promises';
import { join } from 'path';

export class StorageCleaner {
  /**
   * Clear Electron's app data directory
   */
  static async clearElectronAppData(): Promise<void> {
    try {
      // In e2e tests, we'll use the temp directory instead of the actual app data
      const tempAppDataPath = join(process.cwd(), 'tests', 'temp', 'userData');
      console.log(`🗂️ Clearing Electron app data: ${tempAppDataPath}`);

      // Clear specific directories that might contain auth data
      const directoriesToClear = [
        join(tempAppDataPath, 'Local Storage'),
        join(tempAppDataPath, 'Session Storage'),
        join(tempAppDataPath, 'Cookies'),
        join(tempAppDataPath, 'Cookies-journal'),
        join(tempAppDataPath, 'Local Extension Settings'),
        join(tempAppDataPath, 'Preferences'),
      ];

      for (const dir of directoriesToClear) {
        try {
          await access(dir);
          await rm(dir, { recursive: true, force: true });
          console.log(`✅ Cleared: ${dir}`);
        } catch (error) {
          // Directory doesn't exist or can't be accessed, which is fine
        }
      }

      console.log('✅ Electron app data cleared successfully');
    } catch (error) {
      console.warn('⚠️ Could not clear Electron app data:', error);
    }
  }

  /**
   * Clear all possible storage locations
   */
  static async clearAllStorage(): Promise<void> {
    console.log('🧹 Clearing all storage data...');

    // Clear Electron app data
    await this.clearElectronAppData();

    console.log('✅ All storage data cleared');
  }
}
