import { ElectronUtils } from './utils/electron';
import { ensureTempDir } from './scripts/ensureTempDir';
import { getTestEnv } from './config/testConfig';
import { log } from './utils/logger';

async function globalSetup() {
  // Global setup before all tests
  log.info('Setting up e2e test environment...');

  // Ensure base /temp directory exists
  await ensureTempDir();

  // Set up isolated environment variables
  const testEnv = getTestEnv();
  Object.assign(process.env, testEnv);
  log.info('Environment variables configured');

  // Reset any existing Electron instances
  await ElectronUtils.resetGlobalInstance();
}

export default globalSetup;
