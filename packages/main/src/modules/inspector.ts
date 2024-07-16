import path from 'node:path';
import { type Command, npx } from './npx';
import { createRequire } from 'node:module';
import { getAvailablePort } from './port';

export let inspectorServer: Command | null = null;
export async function start() {
  if (inspectorServer) {
    await inspectorServer.kill();
  }

  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve('@dcl/inspector');
  const inspectorPath = path.join(path.dirname(pkgPath), '../public');

  const port = await getAvailablePort();
  inspectorServer = npx('http-server', ['--port', port.toString()], inspectorPath);
  await inspectorServer.waitFor(/available/i, /error/i);

  return port;
}
