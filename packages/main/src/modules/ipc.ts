import { handle } from './handle';
import * as electron from './electron';
import * as inspector from './inspector';
import * as cli from './cli';

export function initIpc() {
  // electron
  handle('electron.getAppHome', () => electron.getAppHome());
  handle('electron.showOpenDialog', (_event, opts) => electron.showOpenDialog(opts));
  handle('electron.openExternal', (_event, url) => electron.openExternal(url));

  // inspector
  handle('inspector.start', () => inspector.start());

  // cli
  handle('cli.init', (_event, path, repo) => cli.init(path, repo));
  handle('cli.start', (_event, path) => cli.start(path));
  handle('cli.deploy', (_event, opts) => cli.deploy(opts));
}
