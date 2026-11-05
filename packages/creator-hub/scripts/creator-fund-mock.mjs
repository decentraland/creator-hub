import {
  createMockServer,
  mockConfigFromEnv,
} from '../main/src/modules/creator-fund-fixtures/server.mjs';

const { port, options } = mockConfigFromEnv(process.env);
createMockServer(options).listen(port, () => {
  console.log(`Creator Fund mock on http://localhost:${port}/v3/creator-fund`);
});
