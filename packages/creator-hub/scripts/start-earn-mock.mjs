import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createMockServer, mockConfigFromEnv } from './creator-fund-mock.mjs';

const { port, options } = mockConfigFromEnv(process.env);
const origin = `http://localhost:${port}`;
const server = createMockServer(options);
await new Promise((resolve, reject) => server.once('error', reject).listen(port, resolve));
console.log(`Creator Fund mock on ${origin}`);

const app = spawn(process.execPath, ['scripts/watch.js', ...process.argv.slice(2)], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: {
    ...process.env,
    CREATOR_FUND_API_URL: origin,
    METRICS_API_URL: `${origin}/v2`,
    WORLDS_CONTENT_SERVER_URL: origin,
  },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.kill(signal));
app.on('exit', code => process.exit(code ?? 0));
