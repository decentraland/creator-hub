import { resolve, join } from 'path';
import { config } from 'dotenv';

// Load .env.e2e file for E2E test configuration
config({ path: '.env.e2e' });

// Helper function to get scene directory path (actually used)
export const getTestScenesDir = (): string => {
  return join(resolve(process.cwd()), 'tests', 'temp', 'scenes');
};

// Helper function to get environment variables for tests
export const getTestEnv = (): Record<string, string> => ({
  NODE_ENV: 'test',
  ELECTRON_ENABLE_LOGGING: 'false',
  ELECTRON_ENABLE_STACK_DUMPING: 'false',
  PORT: '3001',
  DISABLE_ANALYTICS: 'true',
  DISABLE_TELEMETRY: 'true',
  DISABLE_AUTO_UPDATE: 'true',
  CLEAR_AUTH_ON_START: 'true',
  RESET_USER_DATA: 'true',
  TEST_MODE: 'true',
  SKIP_ANALYTICS: 'true',
  SKIP_TELEMETRY: 'true',
  // Include E2E-specific environment variables
  E2E: process.env.E2E || 'true',
  ...(process.env.E2E_NAME ? { E2E_NAME: process.env.E2E_NAME } : {}),
  // Debug logging control
  DEBUG: process.env.DEBUG || 'false',
});
