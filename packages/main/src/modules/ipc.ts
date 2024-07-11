import { handle } from './handle';
import { init, start, deploy } from './cli';
import { getHome } from './electron';

export function initIpc() {
  // electron
  handle('electron.getHome', () => getHome());

  // cli
  handle('cli.init', (_event, name) => init(name));
  handle('cli.start', (_event, path) => start(path));
  handle('cli.deploy', (_event, path) => deploy(path));
}
