import { handle } from './handle';
import * as electron from './electron';
import * as inspector from './inspector';
import * as cli from './cli';
import * as bin from './bin';
import * as analytics from './analytics';
import * as npm from './npm';

export function initIpc() {
  // electron
  handle('electron.getAppVersion', () => electron.getAppVersion());
  handle('electron.getAppHome', () => electron.getAppHome());
  handle('electron.showOpenDialog', (_event, opts) => electron.showOpenDialog(opts));
  handle('electron.openExternal', (_event, url) => electron.openExternal(url));

  // inspector
  handle('inspector.start', () => inspector.start());

  // cli
  handle('cli.init', (_event, path, repo) => cli.init(path, repo));
  handle('cli.start', (_event, path) => cli.start(path));
  handle('cli.deploy', (_event, opts) => cli.deploy(opts));

  // bin
  handle('bin.install', () => bin.install());
  handle('bin.code', (_event, path) => bin.code(path));

  // analytics
  handle('analytics.track', (_event, eventName, data) => analytics.track(eventName, data));
  handle('analytics.identify', (_event, userId, traits) => analytics.identify(userId, traits));
  handle('analytics.getAnonymousId', () => analytics.getAnonymousId());

  // npm
  handle('npm.install', (_event, path) => npm.install(path));
}
