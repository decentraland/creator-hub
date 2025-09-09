import * as path from 'path';
import log from 'electron-log/main';
import type { ChromeDevToolsClient, ServerPort } from './chrome-devtools/client';

const OPEN_DEVTOOLS_ARG = '--open-devtools-with-port';

type ParsedArgs = {
  devtoolsPort: ServerPort | null;
};

type Args = {
  list: string[];
};

export type AppArgsHandle = {
  handle(argv: string[]): void;
};

export function newAppArgsHandle(client: ChromeDevToolsClient): AppArgsHandle {
  function handle(argv: string[]): void {
    const args: Args = argsFrom(argv);
    const parsed: ParsedArgs = parsedArgsFrom(args);
    log.info(`[Args] processing args: ${JSON.stringify(parsed)} from ${argv}`);

    if (parsed.devtoolsPort !== null) {
      void client.openTab(parsed.devtoolsPort);
    }
  }

  return { handle };
}

function argsFrom(argv: string[]): Args {
  // dev: [node, electron, ...args]  -> slice(2)
  // prod: [app.exe, ...args]        -> slice(1)
  const dev = process.defaultApp || /electron(\.exe)?$/i.test(path.basename(process.execPath));
  const sliced = dev ? argv.slice(2) : argv.slice(1);
  return {
    list: sliced,
  };
}

function parsedArgsFrom(args: Args): ParsedArgs {
  const out: ParsedArgs = { devtoolsPort: null };
  for (let i = 0; i < args.list.length; i++) {
    const a: string = args.list[i];
    if (a.startsWith(OPEN_DEVTOOLS_ARG)) {
      if (out.devtoolsPort !== null) {
        log.error('[Args] --open-devtools-with-port already assigned');
        continue;
      }

      // MacOS may change order of arguments
      // format --arg=VALUE allows to safely pass the data
      const value: string | null = a.includes('=') ? a.substring(a.indexOf('=') + 1) : null;

      if (value === null) {
        log.error('[Args] --open-devtools-with-port provided without port');
        continue;
      }

      const port = Number.parseInt(value);
      if (Number.isNaN(port)) {
        log.error(`[Args] --open-devtools-with-port cannot parse port: ${value}`);
        continue;
      }

      out.devtoolsPort = { port };
    }
  }
  return out;
}
