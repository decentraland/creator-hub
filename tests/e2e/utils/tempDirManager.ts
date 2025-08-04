import { mkdir, rm } from 'fs/promises';
import { join, resolve } from 'path';
import { log } from './logger';

export class TempDirManager {
  private static tempDir = join(resolve(process.cwd()), 'tests', 'temp');

  /**
   * Completely removes the /temp directory and recreates it with required subdirectories
   * This ensures a completely clean state for each test
   */
  static async cleanupAndRecreate(): Promise<void> {
    try {
      // First, completely remove the /temp directory if it exists
      log.info('Cleaning up existing /temp directory for test...');
      await rm(this.tempDir, { recursive: true, force: true });
      log.info('Removed existing /temp directory');

      // Create the base /temp directory
      await mkdir(this.tempDir, { recursive: true, mode: 0o755 });
      log.info('Created base /temp directory');

      // Create required subdirectories
      const userDataPath = join(this.tempDir, 'userData');
      const homePath = join(this.tempDir, 'home');
      const scenesPath = join(this.tempDir, 'scenes');

      await mkdir(userDataPath, { recursive: true, mode: 0o755 });
      log.info(`Created userData directory: ${userDataPath}`);

      await mkdir(homePath, { recursive: true, mode: 0o755 });
      log.info(`Created home directory: ${homePath}`);

      await mkdir(scenesPath, { recursive: true, mode: 0o755 });
      log.info(`Created scenes directory: ${scenesPath}`);
    } catch (error) {
      log.error(`Failed to cleanup and recreate temp directory: ${error}`);
      throw error;
    }
  }

  /**
   * Cleans up the /temp directory after a test
   */
  static async cleanup(): Promise<void> {
    try {
      await rm(this.tempDir, { recursive: true, force: true });
      log.info(`Cleaned up temp directory after test: ${this.tempDir}`);
    } catch (error) {
      log.warn(`Could not clean up temp directory: ${error}`);
    }
  }

  /**
   * Gets the temp directory path
   */
  static getTempDir(): string {
    return this.tempDir;
  }
}
