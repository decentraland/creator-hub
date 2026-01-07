import { existsSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import log from 'electron-log';
import * as config from './config';

const execAsync = promisify(exec);

export interface BlenderInfo {
  path: string;
  version: string;
  isValid: boolean;
}

/**
 * Common Blender installation paths by platform
 */
const BLENDER_PATHS = {
  darwin: [
    '/Applications/Blender.app/Contents/MacOS/Blender',
    '/Applications/Blender 4.2.app/Contents/MacOS/Blender',
    '/Applications/Blender 4.1.app/Contents/MacOS/Blender',
    '/Applications/Blender 4.0.app/Contents/MacOS/Blender',
    '/Applications/Blender 3.6.app/Contents/MacOS/Blender',
    '/Applications/Blender 3.5.app/Contents/MacOS/Blender',
    '/Applications/Blender 3.4.app/Contents/MacOS/Blender',
    '/Applications/Blender 3.3.app/Contents/MacOS/Blender',
  ],
  win32: [
    'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 3.5\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 3.4\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 3.3\\blender.exe',
  ],
  linux: [
    '/usr/bin/blender',
    '/usr/local/bin/blender',
    '/snap/bin/blender',
    '/opt/blender/blender',
  ],
};

/**
 * Detect Blender installation on the system
 */
export async function detectBlender(): Promise<BlenderInfo | null> {
  log.info('[Blender Detector] Starting Blender detection...');

  // First check if user has manually set a path
  const customPath = await getCustomBlenderPath();
  if (customPath) {
    log.info('[Blender Detector] Checking custom path:', customPath);
    const info = await validateBlenderPath(customPath);
    if (info?.isValid) {
      log.info('[Blender Detector] Valid custom Blender found:', info);
      return info;
    }
  }

  // Check common installation paths
  const platform = process.platform as keyof typeof BLENDER_PATHS;
  const paths = BLENDER_PATHS[platform] || [];

  for (const path of paths) {
    if (existsSync(path)) {
      log.info('[Blender Detector] Found Blender at:', path);
      const info = await validateBlenderPath(path);
      if (info?.isValid) {
        log.info('[Blender Detector] Valid Blender installation:', info);
        return info;
      }
    }
  }

  // Try to find Blender in PATH
  try {
    log.info('[Blender Detector] Checking PATH for Blender...');
    const command = platform === 'win32' ? 'where blender' : 'which blender';
    const { stdout } = await execAsync(command);
    const path = stdout.trim().split('\n')[0];

    if (path && existsSync(path)) {
      log.info('[Blender Detector] Found Blender in PATH:', path);
      const info = await validateBlenderPath(path);
      if (info?.isValid) {
        log.info('[Blender Detector] Valid Blender from PATH:', info);
        return info;
      }
    }
  } catch (error) {
    log.warn('[Blender Detector] Blender not found in PATH');
  }

  // On macOS, scan Applications folder for Blender.app
  if (platform === 'darwin') {
    log.info('[Blender Detector] Scanning /Applications for Blender...');
    const blenderApp = await findBlenderInApplications();
    if (blenderApp) {
      log.info('[Blender Detector] Found Blender app:', blenderApp);
      const info = await validateBlenderPath(blenderApp);
      if (info?.isValid) {
        log.info('[Blender Detector] Valid Blender from scan:', info);
        return info;
      }
    }
  }

  // On Windows, scan Program Files
  if (platform === 'win32') {
    log.info('[Blender Detector] Scanning Program Files for Blender...');
    const blenderExe = await findBlenderInProgramFiles();
    if (blenderExe) {
      log.info('[Blender Detector] Found Blender executable:', blenderExe);
      const info = await validateBlenderPath(blenderExe);
      if (info?.isValid) {
        log.info('[Blender Detector] Valid Blender from scan:', info);
        return info;
      }
    }
  }

  log.warn('[Blender Detector] No valid Blender installation found');
  return null;
}

/**
 * Validate a Blender path and get version info
 */
export async function validateBlenderPath(path: string): Promise<BlenderInfo | null> {
  try {
    if (!existsSync(path)) {
      return null;
    }

    // On macOS, if path ends with .app, look for the executable inside
    let executablePath = path;
    if (process.platform === 'darwin' && path.endsWith('.app')) {
      executablePath = join(path, 'Contents/MacOS/Blender');
      if (!existsSync(executablePath)) {
        log.warn('[Blender Detector] .app bundle does not contain Blender executable:', executablePath);
        return null;
      }
    }

    log.info('[Blender Detector] Validating Blender at:', executablePath);

    // Run Blender with --version to validate it
    const { stdout } = await execAsync(`"${executablePath}" --version`, {
      timeout: 5000,
    });

    log.info('[Blender Detector] Version output:', stdout);

    // Parse version from output (e.g., "Blender 3.6.5")
    const versionMatch = stdout.match(/Blender\s+([\d.]+)/);
    const version = versionMatch ? versionMatch[1] : 'Unknown';

    return {
      path: executablePath,  // Return the actual executable path, not the .app
      version,
      isValid: true,
    };
  } catch (error: any) {
    log.error('[Blender Detector] Failed to validate Blender path:', path, error);
    return {
      path,
      version: 'Unknown',
      isValid: false,
    };
  }
}

/**
 * Find Blender in /Applications on macOS
 */
async function findBlenderInApplications(): Promise<string | null> {
  try {
    const applicationsDir = '/Applications';
    const files = await readdir(applicationsDir);

    // Look for Blender.app or Blender X.Y.app
    for (const file of files) {
      if (file.startsWith('Blender') && file.endsWith('.app')) {
        const blenderPath = join(applicationsDir, file, 'Contents/MacOS/Blender');
        if (existsSync(blenderPath)) {
          return blenderPath;
        }
      }
    }
  } catch (error) {
    log.warn('[Blender Detector] Error scanning Applications:', error);
  }
  return null;
}

/**
 * Find Blender in Program Files on Windows
 */
async function findBlenderInProgramFiles(): Promise<string | null> {
  try {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const blenderFoundation = join(programFiles, 'Blender Foundation');

    if (!existsSync(blenderFoundation)) {
      return null;
    }

    const folders = await readdir(blenderFoundation);

    // Look for Blender folders (e.g., "Blender 3.6")
    for (const folder of folders) {
      if (folder.startsWith('Blender')) {
        const blenderPath = join(blenderFoundation, folder, 'blender.exe');
        if (existsSync(blenderPath)) {
          return blenderPath;
        }
      }
    }
  } catch (error) {
    log.warn('[Blender Detector] Error scanning Program Files:', error);
  }
  return null;
}

/**
 * Get custom Blender path from config
 */
export async function getCustomBlenderPath(): Promise<string | null> {
  try {
    const cfg = await config.getConfig();
    return cfg.blenderPath || null;
  } catch (error) {
    log.error('[Blender Detector] Error getting custom path:', error);
    return null;
  }
}

/**
 * Set custom Blender path in config
 */
export async function setCustomBlenderPath(path: string): Promise<boolean> {
  try {
    const info = await validateBlenderPath(path);
    if (!info?.isValid) {
      log.error('[Blender Detector] Invalid Blender path:', path);
      return false;
    }

    const cfg = await config.getConfig();
    await config.writeConfig({
      ...cfg,
      blenderPath: path,
    });

    log.info('[Blender Detector] Custom Blender path saved:', path);
    return true;
  } catch (error) {
    log.error('[Blender Detector] Error setting custom path:', error);
    return false;
  }
}

/**
 * Clear custom Blender path
 */
export async function clearCustomBlenderPath(): Promise<void> {
  try {
    const cfg = await config.getConfig();
    await config.writeConfig({
      ...cfg,
      blenderPath: undefined,
    });
    log.info('[Blender Detector] Custom Blender path cleared');
  } catch (error) {
    log.error('[Blender Detector] Error clearing custom path:', error);
  }
}

