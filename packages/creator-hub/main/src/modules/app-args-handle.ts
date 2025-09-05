import * as path from 'path';
import log from 'electron-log/main';

type ParsedArgs = {
  devtoolsPort: number | null;
};

function normalizedArgs(argv: string[]): string[] {
  // dev: [node, electron, ...args]  -> slice(2)
  // prod: [app.exe, ...args]        -> slice(1)
  const dev = process.defaultApp || /electron(\.exe)?$/i.test(path.basename(process.execPath));
  return dev ? argv.slice(2) : argv.slice(1);
}

function parsedArgs(args: string[]): ParsedArgs {
  const out: ParsedArgs = { devtoolsPort: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--open-devtools-with-port') {
      if (out.devtoolsPort !== null) {
        log.error('[Args] --open-devtools-with-port already assigned');
        continue;
      }

      const next = i + 1;
      if (next >= args.length) {
        log.error('[Args] --open-devtools-with-port provided without port');
        continue;
      }

      const raw = args[next];
      const port = Number.parseInt(raw);
      if (Number.isNaN(port)) {
        log.error('[Args] --open-devtools-with-port provided without port');
        continue;
      }

      out.devtoolsPort = port;
    }
  }
  return out;
}

export function processArgs(argv: string[]): void {
  const args = normalizedArgs(argv);
  const parsed = parsedArgs(args);
  log.info('[Args] processing args: ' + JSON.stringify(parsed));
  //TODO consume arg
}
