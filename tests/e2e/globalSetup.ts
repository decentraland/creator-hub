import { mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { ElectronUtils } from './utils/electron';
import { TestEnvironment } from './utils/testEnvironment';
import { ensureTempDir } from './scripts/ensureTempDir';

async function globalSetup() {
  // Global setup before all tests
  console.log('Setting up e2e test environment...');

  // Ensure base /temp directory exists
  await ensureTempDir();

  // Create the specific paths that the Electron app expects in E2E mode
  const tempDir = join(resolve(process.cwd()), 'tests', 'temp');
  const userDataPath = join(tempDir, 'userData');
  const homePath = join(tempDir, 'home');

  try {
    // Create userData directory
    await mkdir(userDataPath, { recursive: true, mode: 0o755 });
    console.log(`✅ Created userData directory: ${userDataPath}`);

    // Create home directory
    await mkdir(homePath, { recursive: true, mode: 0o755 });
    console.log(`✅ Created home directory: ${homePath}`);

    // Create scenes directory
    const scenesPath = join(tempDir, 'scenes');
    await mkdir(scenesPath, { recursive: true, mode: 0o755 });
    console.log(`✅ Created scenes directory: ${scenesPath}`);
  } catch (error) {
    console.error(`❌ Failed to create required directories: ${error}`);
    throw error;
  }

  // Set up clean, isolated test environment
  const testEnvironment = new TestEnvironment();
  await testEnvironment.setup();

  // Reset any existing Electron instances
  await ElectronUtils.resetGlobalInstance();
}

export default globalSetup;
