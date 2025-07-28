import { rm, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { testConfig, getTestEnv } from '../config/testConfig';
import { StorageCleaner } from './storageCleaner';

export interface TestEnvironmentConfig {
  tempDir?: string;
  env?: Record<string, string>;
  isolatedPort?: number;
  clearCache?: boolean;
  mockData?: boolean;
  clearStorage?: boolean;
}

export class TestEnvironment {
  private tempDir: string;
  private originalEnv: NodeJS.ProcessEnv;
  private config: TestEnvironmentConfig;

  constructor(config: TestEnvironmentConfig = {}) {
    this.config = {
      tempDir: testConfig.environment.tempDir,
      env: getTestEnv(),
      isolatedPort: testConfig.environment.isolatedPort,
      clearCache: testConfig.environment.clearCache,
      mockData: testConfig.environment.mockData,
      clearStorage: testConfig.environment.clearStorage,
      ...config,
    };
    this.originalEnv = { ...process.env };
  }

  async setup(): Promise<void> {
    console.log('🧹 Setting up clean test environment...');

    // Create temporary directory using absolute path to tests/temp/
    const projectRoot = resolve(process.cwd());
    this.tempDir = this.config.tempDir || join(projectRoot, 'tests', 'temp');
    const homeDir = join(this.tempDir, 'home');
    const userDataDir = join(this.tempDir, 'userData');
    const scenesDir = join(this.tempDir, 'scenes');

    // Ensure the temp directory exists
    await mkdir(this.tempDir, { recursive: true });
    console.log(`📁 Using temp directory: ${this.tempDir}`);
    await mkdir(homeDir, { recursive: true });
    await mkdir(userDataDir, { recursive: true });
    await mkdir(scenesDir, { recursive: true });

    // Set up isolated environment variables
    await this.setupEnvironment();

    // Clear any existing cache if requested
    if (this.config.clearCache) {
      await this.clearCache();
    }

    // Clear storage data if requested
    if (this.config.clearStorage) {
      await StorageCleaner.clearAllStorage();
    }

    console.log('✅ Test environment setup complete');
  }

  async teardown(): Promise<void> {
    console.log('🧹 Cleaning up test environment...');

    // Restore original environment
    this.restoreEnvironment();

    // Clean up temporary directory
    if (this.tempDir) {
      try {
        await rm(this.tempDir, { recursive: true, force: true });
        console.log(`🗑️ Cleaned up temp directory: ${this.tempDir}`);
      } catch (error) {
        console.warn(`⚠️ Could not clean up temp directory: ${error}`);
      }
    }

    console.log('✅ Test environment cleanup complete');
  }

  private async setupEnvironment(): Promise<void> {
    // Set isolated environment variables
    const testEnv = {
      // Isolate the app from local environment
      NODE_ENV: 'test',
      ELECTRON_ENABLE_LOGGING: 'false',
      ELECTRON_ENABLE_STACK_DUMPING: 'false',

      // Use isolated port
      PORT: this.config.isolatedPort?.toString() || '3001',

      // Disable analytics and telemetry
      DISABLE_ANALYTICS: 'true',
      DISABLE_TELEMETRY: 'true',

      // Use test data directory
      TEST_DATA_DIR: this.tempDir,

      // Disable auto-updates
      DISABLE_AUTO_UPDATE: 'true',

      // Force clean authentication state
      CLEAR_AUTH_ON_START: 'true',
      RESET_USER_DATA: 'true',

      // Override with custom config
      ...this.config.env,
    };

    // Apply environment variables
    Object.assign(process.env, testEnv);
  }

  private restoreEnvironment(): void {
    // Restore original environment
    Object.assign(process.env, this.originalEnv);
  }

  private async clearCache(): Promise<void> {
    // Clear any application cache that might interfere with tests
    const cacheDirs = [join(this.tempDir, '.cache'), join(this.tempDir, 'node_modules/.cache')];

    for (const cacheDir of cacheDirs) {
      try {
        await rm(cacheDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore errors if cache doesn't exist
      }
    }
  }

  getTempDir(): string {
    return this.tempDir;
  }

  getConfig(): TestEnvironmentConfig {
    return { ...this.config };
  }
}
