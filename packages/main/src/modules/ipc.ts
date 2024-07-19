import { handle } from './handle';
import * as electron from './electron';
import * as inspector from './inspector';
import * as cli from './cli';
import * as config from './config';

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

  // config
  handle('config.get', _event => config.getConfig());
  handle('config.write', (_event, _config) => config.writeConfig(_config));
}
