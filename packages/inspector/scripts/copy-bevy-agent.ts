import { execFileSync } from 'child_process';
import fs from 'fs';
import { resolve } from 'path';

// Export the super-user editor-agent scene (agents/bevy) as a STATIC realm into
// the inspector's served `public/bevy-agent/` dir. The Bevy engine loads the
// agent via `?systemScene=<realm url>`, and it consumes a realm the Catalyst way
// — it GETs `<systemScene>/about`, whose `scenesUrn` carries the entity + a
// `baseUrl` the content hashes resolve against. `sdk-commands export-static`
// produces exactly that layout (a `<realmName>/about` file + content-hash files),
// so a plain static host (our http-server) can serve it — no second sdk-commands
// process at runtime.
//
// The one runtime-dynamic bit is the origin: the inspector http-server's port is
// chosen per app launch, so we bake a `__ORIGIN__` placeholder into the baseUrl
// here and the host rewrites `about` to the real origin when it serves the app
// (creator-hub main/inspector.ts). Everything else is content-addressed and
// immutable.
//
// The agent is a SEPARATE SDK7 project with its own node_modules (NOT a
// workspace) pinned to the engine's companion SDK — so we run ITS sdk-commands,
// not the inspector's. Its `bin/index.js` must already be built.

const AGENT_DIR = resolve(__dirname, '../agents/bevy');
const DEST = resolve(__dirname, '../public/bevy-agent');
const REALM_NAME = 'bevy-agent';
// Served at `<origin>/bevy-agent/`; the placeholder is swapped for the real
// origin at serve time. Trailing slash is required by export-static.
const BASE_URL = 'http://__ORIGIN__/bevy-agent/';

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
    BASE_URL,
  ],
  { cwd: AGENT_DIR, stdio: 'inherit' },
);

const about = resolve(DEST, REALM_NAME, 'about');
if (!fs.existsSync(about)) {
  throw new Error(`export-static did not produce ${about}`);
}

console.log(`Exported agent realm → ${DEST} (systemScene = <origin>/bevy-agent/bevy-agent)`);
