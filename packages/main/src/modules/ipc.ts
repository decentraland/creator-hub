import {handle} from './handle';
import {init, preview, publish} from './cli';
import {getHome} from './electron';

export function initIpc() {
  // electron
  handle('electron.getHome', () => getHome());

  // cli
  handle('cli.init', (_event, name) => init(name));
  handle('cli.preview', (_event, path) => preview(path));
  handle('cli.publish', (_event, path) => publish(path));
}
