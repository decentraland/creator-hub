import type { Outdated } from '/shared/types/npm';
import { spawn } from 'child_process';
import log from 'electron-log/main';

import { run, StreamError } from './bin';

export async function install(path: string, packages: string[] = []) {
  log.info(`[ALE] Installing dependencies in path: ${path}`);
  const installCommand = run('npm', 'npm', {
    args: ['install', '--loglevel', 'error', '--save-exact', ...packages],
    cwd: path,
  });
  await installCommand.wait();
}

export async function getContextFiles(path: string) {
  log.info(`[ALE] Running get-context-files in path: ${path}`);

  try {
    const child = spawn(
      'npx',
      ['@dcl/sdk-commands', 'get-context-files', '--loglevel', 'verbose'],
      {
        cwd: path,
        shell: true,
        env: { ...process.env },
      },
    );

    return new Promise<void>((resolve, reject) => {
      child.stdout?.on('data', data => log.info(`[ALE get-context] ${data.toString()}`));
      child.stderr?.on('data', data => log.error(`[ALE get-context] ${data.toString()}`));

      child.on('error', error => {
        log.error(`[get-context-files] execution failed: ${error.message}`);
        reject(error);
      });

      child.on('exit', code => {
        if (code === 0) {
          log.info(`[get-context-files] completed successfully in ${path}`);
          resolve();
        } else {
          log.error(`[get-context-files] execution failed with code ${code} in ${path}`);
          reject(new Error(`get-context-files failed with code ${code}`));
        }
      });
    });
  } catch (error) {
    log.error(`[get-context-files] Failed to run get-context-files: ${error}`);
    throw error;
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
