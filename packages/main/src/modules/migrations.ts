import path from 'path';
import fs from 'fs/promises';
import log from 'electron-log/main';
import { SCENES_DIRECTORY } from '/shared/paths';
import { getAppHomeLegacy, getUserDataPath } from './electron';
import { CONFIG_PATH } from './config';

export async function runMigrations() {
  log.info('[Migrations] Starting migrations');
  await migrateLegacyPaths();
  log.info('[Migrations] Migrations completed');
}

async function isValidScene(scenePath: string): Promise<boolean> {
  try {
    // Check if it's a directory first
    const stats = await fs.stat(scenePath);
    if (!stats.isDirectory()) {
      log.info('[Migration] Not a directory:', scenePath);
      return false;
    }

    // check if scene is a valid scene (if it contains a scene.json)
    const sceneJsonPath = path.join(scenePath, 'scene.json');
    await fs.stat(sceneJsonPath);
    return true;
  } catch (err) {
    log.info('[Migration] Invalid scene:', scenePath, err instanceof Error ? err.message : '');
    return false;
  }
}

async function copyScene(sourcePath: string, targetPath: string) {
  log.info('[Migration] Copying scene:', { from: sourcePath, to: targetPath });

  // Create target directory
  await fs.mkdir(targetPath, { recursive: true });

  // Copy scene directory contents excluding node_modules
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules') {
      log.info('[Migration] Skipping node_modules directory for scene:', sourcePath);
      continue;
    }

    const srcPath = path.join(sourcePath, entry.name);
    const destPath = path.join(targetPath, entry.name);
    await fs.cp(srcPath, destPath, { recursive: true });
  }

  log.info('[Migration] Successfully copied scene:', sourcePath);
}

// Migrations
async function migrateLegacyPaths() {
  log.info('[Migration] Starting legacy paths migration');
  const userDataPath = getUserDataPath();
  const appHomeLegacy = getAppHomeLegacy();
  const normalizedLegacyPath = path.normalize(appHomeLegacy);

  log.info('[Migration] Paths:', {
    userDataPath,
    appHomeLegacy,
  });

  // Create scenes directory if it doesn't exist
  const scenesPath = path.join(userDataPath, SCENES_DIRECTORY);
  try {
    await fs.stat(scenesPath);
    // If scenes directory exists, migration was already done
    log.info('[Migration] Scenes directory already exists, skipping migration');
    return;
  } catch {
    // Create scenes directory if it doesn't exist
    log.info('[Migration] Creating scenes directory:', scenesPath);
    await fs.mkdir(scenesPath, { recursive: true });
  }

  try {
    // Read config.json if it exists
    const legacyConfigPath = path.join(appHomeLegacy, 'config.json');
    let config: { workspace?: { paths?: string[] }; settings?: { scenesPath?: string } } = {};

    try {
      log.info('[Migration] Reading config.json from legacy path');
      const configContent = await fs.readFile(legacyConfigPath, 'utf8');
      config = JSON.parse(configContent);
    } catch {
      log.info('[Migration] No config.json found in legacy path, skipping migration');
      return;
    }

    // Update default scenes path if it points to legacy path
    if (config.settings?.scenesPath) {
      const normalizedScenesPath = path.normalize(config.settings.scenesPath);
      if (normalizedScenesPath === normalizedLegacyPath) {
        log.info('[Migration] Updating default scenes path:', {
          from: normalizedScenesPath,
          to: scenesPath,
        });
        config.settings.scenesPath = scenesPath;
      }
    }

    if (config.workspace?.paths?.length) {
      // Process each path in the workspace
      const updatedPaths: string[] = [];
      for (const scenePath of config.workspace.paths) {
        const normalizedPath = path.normalize(scenePath);

        // Only process paths within the legacy directory
        if (!normalizedPath.startsWith(normalizedLegacyPath)) {
          log.info('[Migration] Skipping path outside legacy directory:', scenePath);
          updatedPaths.push(scenePath);
          continue;
        }

        // Validate the scene
        if (!(await isValidScene(normalizedPath))) {
          log.info('[Migration] Skipping invalid scene:', scenePath);
          updatedPaths.push(scenePath);
          continue;
        }

        // Calculate new path and copy scene
        const relativePath = path.relative(normalizedLegacyPath, normalizedPath);
        const newPath = path.join(scenesPath, relativePath);
        await copyScene(normalizedPath, newPath);
        updatedPaths.push(newPath);
      }

      // Update and write the config
      config.workspace.paths = updatedPaths;
    } else {
      log.info('[Migration] No workspace paths found in config.json');
    }

    log.info('[Migration] Writing updated config.json to:', CONFIG_PATH);
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    log.info('[Migration] Successfully migrated config.json');

    log.info('[Migration] Legacy paths migration completed successfully');
  } catch (error) {
    // If anything fails during migration, delete the scenes directory so it will be attempted again
    log.error('[Migration] Error during migration:', error);
    try {
      log.info('[Migration] Cleaning up scenes directory after failure');
      await fs.rm(scenesPath, { recursive: true, force: true });
      log.info('[Migration] Successfully cleaned up scenes directory');
    } catch (cleanupError) {
      // Ignore errors during cleanup
      log.error('[Migration] Failed to cleanup scenes directory:', cleanupError);
    }
    throw error; // Re-throw the original error
  }
}