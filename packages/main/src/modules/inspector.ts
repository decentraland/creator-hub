import path from 'node:path';
import log from 'electron-log';
import { run, type Child } from './bin';
import { getAvailablePort } from './port';
import { APP_UNPACKED_PATH } from './path';

export let inspectorServer: Child | null = null;
export async function start() {
  if (inspectorServer) {
    await inspectorServer.kill();
  }

  const port = await getAvailablePort();
  inspectorServer = run('http-server', 'http-server', {
    args: ['--port', port.toString()],
    cwd: path.join(APP_UNPACKED_PATH, './node_modules/@dcl/inspector/public'),
  });

  await inspectorServer.waitFor(/available/i, /error/i).catch(error => log.error(error.message));

  return port;
}
