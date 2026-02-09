import * as path from 'path';
import log from 'electron-log/main';
import { BrowserWindow } from 'electron';

// Inlined approach proposed by Nico: https://github.com/decentraland/creator-hub/pull/766#discussion_r2359198135
// If we will need more structured option refer to the original implementation: https://github.com/decentraland/creator-hub/pull/766#discussion_r2359459892

function getArgs(argv: string[]): string[] {
  const isDev = process.defaultApp || /electron(\.exe)?$/i.test(path.basename(process.execPath));
  return isDev ? argv.slice(2) : argv.slice(1);
}

export function tryOpenDevToolsOnPort(argv: string[]): void {
  const args = getArgs(argv);

  for (const arg of args) {
    if (arg.startsWith('--open-devtools-with-port=')) {
      const portStr = arg.split('=')[1];
      const port = parseInt(portStr);

      if (isNaN(port)) {
        log.error(`Invalid port: ${portStr}`);
        continue;
      }

      log.info(`Opening devtools on port ${port}`);
      const devtoolsWindow = new BrowserWindow();
      devtoolsWindow.loadURL(`devtools://devtools/bundled/inspector.html?ws=127.0.0.1:${port}`);
      break;
    }
  }
}

/**
 * Parses the --env CLI argument.
 * @param argv - Command line arguments array
 * @returns 'dev', 'prod', or null if no valid override specified
 */
export function parseEnvArgument(argv: string[]): 'dev' | 'prod' | null {
  const args = getArgs(argv);

  for (const arg of args) {
    if (arg.startsWith('--env=')) {
      const envValue = arg.split('=')[1] as 'dev' | 'prod';
      if (envValue === 'dev' || envValue === 'prod') {
        log.info(`[Args] Environment override: ${envValue}`);
        return envValue;
      } else {
        log.warn(`[Args] Invalid environment value: ${envValue}. Must be 'dev' or 'prod'`);
      }
    }
  }

  return null;
}
