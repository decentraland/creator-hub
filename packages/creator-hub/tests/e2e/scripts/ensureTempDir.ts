import { mkdir, access } from 'fs/promises';
import { constants } from 'fs';
import { resolve, join } from 'path';
import { log } from '../utils/logger';

export const ensureTempDir = async (): Promise<void> => {
  const tempDir = join(resolve(process.cwd()), 'tests', 'temp');

  try {
    // Check if directory exists and is writable
    await access(tempDir, constants.R_OK | constants.W_OK);
    log.info('/temp directory exists and is writable');
  } catch (error) {
    log.info('Creating /temp directory...');
    try {
      await mkdir(tempDir, { recursive: true, mode: 0o755 });
      log.info('Created /temp directory');
    } catch (createError) {
      log.error(`Failed to create /temp directory: ${createError}`);
      throw new Error(
        'Cannot create /temp directory. Please ensure you have write permissions or create it manually.',
      );
    }
  }
};

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureTempDir().catch(console.error);
}
