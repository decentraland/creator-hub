import { app } from 'electron';
import path from 'node:path';
import { run, type Child } from './bin';
import { getAvailablePort } from './port';

export let inspectorServer: Child | null = null;
export async function start() {
  if (inspectorServer) {
    await inspectorServer.kill();
  }

  const inspectorPath = path.join(app.getAppPath(), './node_modules/@dcl/inspector/public');

  const port = await getAvailablePort();
  inspectorServer = run(
    'http-server',
    'http-server',
    '',
    ['--port', port.toString()],
    inspectorPath,
  );
  await inspectorServer.waitFor(/available/i, /error/i);

  return port;
}