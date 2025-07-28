import { resolve, join } from 'path';
import { config } from 'dotenv';

// Load .env.e2e file for E2E test configuration
config({ path: '.env.e2e' });

export interface TestConfig {
  // Environment settings
  environment: {
    tempDir: string;
    isolatedPort: number;
    clearCache: boolean;
    mockData: boolean;
    clearStorage: boolean;
  };

  // App settings
  app: {
    timeout: number;
    retryAttempts: number;
    waitForSelectorTimeout: number;
  };

  // Test data settings
  testData: {
    mockProjectName: string;
    mockSceneTitle: string;
    mockSceneDescription: string;
  };
}

export const testConfig: TestConfig = {
  environment: {
    // Use absolute path to tests/temp/ directory for all test data
    tempDir: join(resolve(process.cwd()), 'tests', 'temp'),
    isolatedPort: 3001,
    clearCache: true,
    mockData: true,
    clearStorage: true,
  },

  app: {
    timeout: parseInt(process.env.E2E_TIMEOUT || '10000', 10),
    retryAttempts: 3,
    waitForSelectorTimeout: 5000,
  },

  testData: {
    mockProjectName: 'test-scene',
    mockSceneTitle: process.env.E2E_SCENE_NAME || 'E2E test scene',
    mockSceneDescription: 'A test scene for E2E testing',
  },
};

// Helper function to get test-specific temp directory
export const getTestTempDir = (): string => {
  return join(testConfig.environment.tempDir);
};

export const getTestScenesDir = (sceneName: string): string => {
  return join(testConfig.environment.tempDir, 'scenes', sceneName);
};

// Helper function to get environment variables for tests
export const getTestEnv = (): Record<string, string> => ({
  NODE_ENV: 'test',
  ELECTRON_ENABLE_LOGGING: 'false',
  ELECTRON_ENABLE_STACK_DUMPING: 'false',
  PORT: testConfig.environment.isolatedPort.toString(),
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
});
