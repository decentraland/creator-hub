import { execFileSync } from 'child_process';
import fs from 'fs';
import { resolve } from 'path';

import { AGENT_BASE_URL, REALM_NAME, SERVED_DIR } from '../bevy-agent-realm';

// Export the super-user editor-agent scene (agents/bevy) as a STATIC realm into
// the inspector's served `public/bevy-agent/` dir. The Bevy engine loads the
// agent via `?systemScene=<realm url>`, and it consumes a realm the Catalyst way
// — it GETs `<systemScene>/about`, whose `scenesUrn` carries the entity + a
// `baseUrl` the content hashes resolve against. `sdk-commands export-static`
// produces exactly that layout (a `<realmName>/about` file + content-hash files),
// so a plain static host (our http-server) can serve it — no second sdk-commands
// process at runtime.
//
// The one runtime-dynamic bit is the origin: the serving port is chosen per
// launch, so the baseUrl carries a placeholder that the server swaps out per
// request — the Creator Hub's inspector server in the app, the dev proxy in
// build.js when running against a watch build. Everything else is
// content-addressed and immutable. See ../bevy-agent-realm.js for the contract.
//
// The agent is a SEPARATE SDK7 project with its own node_modules (NOT a
// workspace) pinned to the engine's companion SDK — so we run ITS sdk-commands,
// not the inspector's. Its `bin/index.js` must already be built.

const AGENT_DIR = resolve(__dirname, '../agents/bevy');
const DEST = resolve(__dirname, '..', 'public', SERVED_DIR);

const agentBin = resolve(AGENT_DIR, 'bin/index.js');
if (!fs.existsSync(agentBin)) {
  throw new Error(
    `Agent scene is not built: ${agentBin} is missing. Run \`npm install && npm run build\` in agents/bevy first.`,
  );
}

const sdkCommands = resolve(AGENT_DIR, 'node_modules/.bin/sdk-commands');
if (!fs.existsSync(sdkCommands)) {
  throw new Error(
    `Agent has no sdk-commands: ${sdkCommands} is missing. Run \`npm install\` in agents/bevy first.`,
  );
}

console.log('Exporting agent scene → static realm at "public/bevy-agent"...');

// Fresh each build so a changed agent can't leave stale content-hash files behind.
fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });

execFileSync(
  sdkCommands,
  [
    'export-static',
    '--dir',
    AGENT_DIR,
    '--destination',
    DEST,
    '--realmName',
    REALM_NAME,
    '--baseUrl',
    AGENT_BASE_URL,
  ],
  { cwd: AGENT_DIR, stdio: 'inherit' },
);

const about = resolve(DEST, REALM_NAME, 'about');
if (!fs.existsSync(about)) {
  throw new Error(`export-static did not produce ${about}`);
}

console.log(`Exported agent realm → ${DEST} (systemScene = <origin>/bevy-agent/bevy-agent)`);
