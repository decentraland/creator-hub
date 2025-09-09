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
    if (a === OPEN_DEVTOOLS_ARG) {
      if (out.devtoolsPort !== null) {
        log.error('[Args] --open-devtools-with-port already assigned');
        continue;
      }

      const next = i + 1;
      if (next >= args.list.length) {
        log.error('[Args] --open-devtools-with-port provided without port');
        continue;
      }

      const raw = args.list[next];
      const port = Number.parseInt(raw);
      if (Number.isNaN(port)) {
        log.error('[Args] --open-devtools-with-port provided without port');
        continue;
      }

      out.devtoolsPort = { port };
    }
  }
  return out;
}
