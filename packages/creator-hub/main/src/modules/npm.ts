import type { Outdated } from '/shared/types/npm';
import { spawn } from 'child_process';
import log from 'electron-log/main';

import { run, StreamError } from './bin';

export function spawnInstall(scenePath: string, packages: string[] = []): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    log.info(`[ALE] Installing dependencies in path: ${scenePath}`);

    const args = [
      'install',
      '--loglevel',
      'verbose',
      '--save-exact',
      '--foreground-scripts=true',
      '--unsafe-perm=true',
      '--ignore-scripts=false',
      ...packages,
    ];

    const child = spawn('npm', args, {
      cwd: scenePath,
      shell: true,
      env: {
        ...process.env,
        npm_config_unsafe_perm: 'true',
        npm_config_foreground_scripts: 'true',
        npm_config_ignore_scripts: 'false',
      },
    });

    child.stdout?.on('data', data => log.info(`[ALE stdout] ${data.toString()}`));
    child.stderr?.on('data', data => log.error(`[ALE stderr] ${data.toString()}`));

    child.on('error', error => {
      log.error(`[ALE] Process error: ${error.message}`);
      reject(error);
    });

    child.on('exit', code => {
      if (code === 0) {
        log.info(`[ALE] npm install completado en ${scenePath}`);
        resolve();
      } else {
        log.error(`[ALE] npm install falló con código ${code} en ${scenePath}`);
        reject(new Error(`npm install falló con código ${code}`));
      }
    });
  });
}

export async function install(path: string, packages: string[] = []) {
  log.info(`[ALE] Installing dependencies in path: ${path}`);

  try {
    await spawnInstall(path, packages);
    log.info('[ALE] Installation completed successfully via spawn');
  } catch (error) {
    log.warn(`[ALE] spawnInstall failed, trying utilityProcess fallback: ${error}`);

    const installCommand = run('npm', 'npm', {
      args: [
        'install',
        '--loglevel',
        'verbose',
        '--save-exact',
        '--foreground-scripts=true',
        '--unsafe-perm=true',
        '--ignore-scripts=false',
        ...packages,
      ],
      cwd: path,
      env: {
        npm_config_unsafe_perm: 'true',
        npm_config_foreground_scripts: 'true',
        npm_config_ignore_scripts: 'false',
      },
    });
    await installCommand.wait();
    log.info('[ALE] Installation completed successfully via utilityProcess');
  }
}

/**
 * Fetches information about outdated dependencies for a given project directory.
 * It runs the `npm outdated` command and parses the output to return a list of outdated packages.
 *
 * @param _path - The directory path where the npm command should be executed.
 * @param packages - An optional array of specific package names to check for outdated versions.
 * @returns A Promise that resolves to an object containing details about outdated packages.
 *          If no outdated packages are found or an error occurs, an empty object is returned.
 */
export async function getOutdatedDeps(_path: string, packages: string[] = []): Promise<Outdated> {
  try {
    const npmOutdated = run('npm', 'npm', {
      args: ['outdated', '--depth=0', '--json', ...packages],
      cwd: _path,
    });

    await npmOutdated.wait();
    return {};
  } catch (e) {
    if (e instanceof StreamError) {
      return parseOutdated(e.stdout);
    }
    return {};
  }
}

/**
 * Parses the result of `npm outdated --depth=0 --json` to match the `Outdated` structure.
 * Handles cases where the package info may be an array or an object.
 *
 * @param buffer - The Buffer output from the `npm outdated` command.
 * @returns An object matching the `Outdated` type, containing package names with their current and latest versions.
 */
export function parseOutdated(buffer: Buffer): Outdated {
  try {
    const parsed = JSON.parse(buffer.toString('utf8'));

    const result: Outdated = {};
    for (const [pkg, info] of Object.entries(parsed)) {
      if (Array.isArray(info) && info.length > 0) {
        result[pkg] = {
          current: info[0].current,
          latest: info[0].latest,
        };
      } else if (info && typeof info === 'object' && 'current' in info && 'latest' in info) {
        result[pkg] = {
          current: info.current as string,
          latest: info.latest as string,
        };
      }
    }

    return result;
  } catch (_) {
    return {};
  }
}
