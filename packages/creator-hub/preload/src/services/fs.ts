import fs from 'fs/promises';
import nodePath from 'path';

type WriteFileData = Parameters<typeof fs.writeFile>[1];
type WriteFileOptions = Parameters<typeof fs.writeFile>[2];

export async function resolve(...paths: string[]) {
  return nodePath.resolve(...paths);
}

export async function readFile(path: string) {
  return fs.readFile(path);
}

export async function writeFile(path: string, content: WriteFileData, options?: WriteFileOptions) {
  await fs.mkdir(nodePath.dirname(path), { recursive: true });
  await fs.writeFile(path, content, options);
}

export async function exists(path: string) {
  try {
    await fs.stat(path);
    return true;
  } catch (error) {
    return false;
  }
}

export async function rm(path: string, options?: { recursive?: boolean }) {
  await fs.rm(path, options);
}

export async function readdir(path: string) {
  return fs.readdir(path);
}

export async function isDirectory(path: string) {
  try {
    const stats = await fs.stat(path);
    return stats.isDirectory();
  } catch (_) {
    return false;
  }
}

/**
 * Returns whether or not the provided path is writable (can create files/folders inside it)
 */
export async function isWritable(path: string): Promise<boolean> {
  try {
    // First, try to access the exact path if it exists
    await fs.access(path, fs.constants.W_OK);
    return true; // Path exists and is writable
  } catch (error) {
    const errno = (error as NodeJS.ErrnoException).code;

    if (errno === 'ENOENT') {
      // Path doesn't exist, so check the nearest existing parent directory
      console.log(`Path ${path} does not exist, checking parent directory for writability...`);
      const parentPath = nodePath.dirname(path);
      if (parentPath === path) return false; // Reached filesystem root without finding an existing parent
      return await isWritable(parentPath);
    }

    console.log(`Access check failed for path ${path} with error code: ${errno}`);
    // On Windows, W_OK can be unreliable - try actual write test for permission errors
    if (process.platform === 'win32' && (errno === 'EACCES' || errno === 'EPERM')) {
      console.log(`Path ${path} is not writable, attempting to write a test file on windows...`);
      return await tryActualWrite(path);
    }

    return false; // Permission denied or some other error
  }
}

/**
 * Windows-specific: Try to actually write a test file to verify write permissions
 */
async function tryActualWrite(path: string): Promise<boolean> {
  const testFileName = '.temp-write-test-' + Date.now();
  const testFilePath = nodePath.join(path, testFileName);

  try {
    // Check if the directory exists first
    const pathExists = await exists(path);
    if (!pathExists) {
      // Try to create the directory
      await fs.mkdir(path, { recursive: true });
    }

    // Try to write a test file
    await fs.writeFile(testFilePath, '');
    // Clean up immediately
    await fs.rm(testFilePath);
    return true;
  } catch (error) {
    console.error(
      `WINDOWS Error occurred while testing write permissions for path ${path}:`,
      error,
    );
    return false;
  }
}

export async function mkdir(path: string, options?: { recursive?: boolean }) {
  await fs.mkdir(path, options);
}

export async function rmdir(path: string) {
  await fs.rmdir(path);
}

export async function stat(path: string) {
  return fs.stat(path);
}

export async function cp(src: string, dest: string, options?: { recursive?: boolean }) {
  await fs.cp(src, dest, options);
}
