import { handle } from './handle';
import { init, start, deploy } from './cli';
import { getAppHome, showOpenDialog } from './electron';

export function initIpc() {
  // electron
  handle('electron.getAppHome', () => getAppHome());
  handle('electron.showOpenDialog', (_event, opts) => showOpenDialog(opts));

  // cli
  handle('cli.init', (_event, name) => init(name));
  handle('cli.start', (_event, path) => start(path));
  handle('cli.deploy', (_event, path) => deploy(path));
}
