import { rm } from 'fs/promises';
import { join, resolve } from 'path';
import { ElectronUtils } from './utils/electron';

async function globalTeardown() {
  // Global cleanup after all tests
  console.log('Cleaning up e2e test environment...');

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
    console.log(`🗑️ Cleaned up userData directory: ${userDataPath}`);

    // Clean up home directory
    await rm(homePath, { recursive: true, force: true });
    console.log(`🗑️ Cleaned up home directory: ${homePath}`);

    // Clean up scenes directory
    await rm(scenesPath, { recursive: true, force: true });
    console.log(`🗑️ Cleaned up scenes directory: ${scenesPath}`);

    // Optionally clean up the entire temp directory
    // await rm(tempDir, { recursive: true, force: true });
    // console.log(`🗑️ Cleaned up temp directory: ${tempDir}`);
  } catch (error) {
    console.warn(`⚠️ Could not clean up directories: ${error}`);
  }
}

export default globalTeardown;
