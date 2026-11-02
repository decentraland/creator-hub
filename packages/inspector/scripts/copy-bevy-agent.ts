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
// not the inspector's, both to build it and to export it.

const AGENT_DIR = resolve(__dirname, '../agents/bevy');
const DEST = resolve(__dirname, '..', 'public', SERVED_DIR);
const AGENT_SOURCES = [resolve(AGENT_DIR, 'src'), resolve(__dirname, '../agents/protocol/src')];

const sdkCommands = resolve(AGENT_DIR, 'node_modules/.bin/sdk-commands');
if (!fs.existsSync(sdkCommands)) {
  throw new Error(
    `Agent has no sdk-commands: ${sdkCommands} is missing. Run \`npm install\` in agents/bevy first.`,
  );
}

/** Newest mtime under `dir`, recursively (directory entries included — harmless for a max). */
function newestMtime(dir: string): number {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .reduce((newest, entry) => Math.max(newest, fs.statSync(resolve(dir, entry)).mtimeMs), 0);
}

/**
 * Build the agent when its sources are newer than its bundle (or it has none).
 *
 * Without this the export ships a STALE agent: the inspector's own build/watch
 * only COPIES `bin/index.js`, so an agent source change stays invisible at
 * runtime — the engine keeps loading the old bundle — until someone remembers
 * `make build-bevy-agent`.
 */
function buildAgentIfStale(): void {
  const agentBin = resolve(AGENT_DIR, 'bin/index.js');
  const binMtime = fs.existsSync(agentBin) ? fs.statSync(agentBin).mtimeMs : 0;
  if (!AGENT_SOURCES.some(dir => newestMtime(dir) > binMtime)) return;
  console.log('Agent sources changed → building agents/bevy...');
  execFileSync(sdkCommands, ['build'], { cwd: AGENT_DIR, stdio: 'inherit' });
}

buildAgentIfStale();

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
