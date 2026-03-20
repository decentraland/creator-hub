import path from 'path';
import { Env } from '/shared/types/env';
import log from 'electron-log';
import { openDevToolsWindow } from './devtools';
import { setEnvOverride } from './electron';

function getArgs(argv: string[]): string[] {
  const isDev = process.defaultApp || /electron(\.exe)?$/i.test(path.basename(process.execPath));
  return isDev ? argv.slice(2) : argv.slice(1);
}

function handleEnv(value: string): void {
  const envValue = value as Env;
  if (Object.values(Env).includes(envValue)) {
    log.info(`[Args] Environment override: ${envValue}`);
    setEnvOverride(envValue);
  } else {
    log.warn(
      `[Args] Invalid environment value: ${envValue}. Must be one of: ${Object.values(Env).join('|')}`,
    );
  }
}

function handleOpenDevtoolsWithPort(value: string): void {
  const port = parseInt(value, 10);
  if (Number.isNaN(port)) {
    log.error('[DevTools] Invalid port:', value);
    return;
  }
  log.info('[DevTools] Opening DevTools window for port:', port);
  openDevToolsWindow(port);
}

const ARG_HANDLERS: Record<string, (value: string) => Env | null | void> = {
  '--env=': handleEnv,
  '--open-devtools-with-port=': handleOpenDevtoolsWithPort,
};

/**
 * Handles app CLI arguments: --env= and --open-devtools-with-port=.
 * Invokes the matching handler for each recognized prefix (env override, DevTools window).
 *
 * @param argv - Command line arguments array
 * @returns void
 */
export function handleAppArguments(argv: string[]): void {
  const args = getArgs(argv);

  log.info(`[Args] Parsing arguments: ${args.join(', ')}`);

  for (const arg of args) {
    for (const [prefix, handler] of Object.entries(ARG_HANDLERS)) {
      log.info(`[Args] Handling argument: ${arg} with prefix: ${prefix}`);
      if (!arg.startsWith(prefix)) continue;

      const value = arg.slice(prefix.length);
      log.info(`[Args] Value: ${value}`);
      handler(value);
    }
  }
}
