import path from 'node:path';
import { type Command, npx } from './npx';
import { createRequire } from 'node:module';

export let inspectorServer: Command | null = null;
export async function initInspector() {
  if (inspectorServer) {
    await inspectorServer.kill();
  }

  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve('@dcl/inspector');
  const inspectorPath = path.join(path.dirname(pkgPath), '../public');

  inspectorServer = npx('http-server', ['--port', '8734'], inspectorPath);
}
