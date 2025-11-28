import { rm } from 'fs/promises';
import { join, resolve } from 'path';
import { ElectronUtils } from './utils/electron';
import { log } from './utils/logger';

async function globalTeardown() {
  // Global cleanup after all tests
  log.info('Cleaning up e2e test environment...');

  // Ensure Electron app is closed
  const electronUtils = new ElectronUtils();
  await electronUtils.cleanup();

  // Clean up the specific directories that were created
  const tempDir = join(resolve(process.cwd()), 'tests', 'temp');
  const userDataPath = join(tempDir, 'userData');
  const homePath = join(tempDir, 'home');
  const scenesPath = join(tempDir, 'scenes');

  try {
    // Clean up userData directory
    await rm(userDataPath, { recursive: true, force: true });
    log.info(`Cleaned up userData directory: ${userDataPath}`);

    // Clean up home directory
    await rm(homePath, { recursive: true, force: true });
    log.info(`Cleaned up home directory: ${homePath}`);

    // Clean up scenes directory
    await rm(scenesPath, { recursive: true, force: true });
    log.info(`Cleaned up scenes directory: ${scenesPath}`);
  } catch (error) {
    log.warn(`Could not clean up directories: ${error}`);
  }
}

export default globalTeardown;
