import fs from 'fs';
import { resolve } from 'path';

// Copy the prebuilt bevy-explorer web bundle (engine wasm + JS glue) into the
// inspector's served `public/bevy-engine/` dir, then add our own `engine.html`
// host page. The Bevy renderer mounts that host page in a same-origin iframe; the
// browser only enables the wasm's SharedArrayBuffer threads when the document is
// served with COOP/COEP, which the dev server (build.js) + Electron stamp on. The
// copied bundle is kept out of git (see .gitignore) — a large (~100MB) build
// artifact from the installed npm package, exactly like `public/bin` from
// @dcl/asset-packs.
//
// The engine package ships the "react-web" layout (since ~commit-4472a75): the
// engine proper lives under `engine/` (engine.js + boot.js + pkg/ wasm), and the
// package's ROOT index.html is the full Decentraland React HUD served from a CDN —
// NOT a bare, embeddable engine. So we DON'T use that index.html; we ship our own
// `engine.html` (copied from `scripts/bevy-engine-host/`) that boots the engine
// same-origin via its boot contract (`engine/boot.js` + `__bevyLaunch`). See
// engine-iframe.ts.

const PACKAGE = '@dcl-regenesislabs/bevy-explorer-web';

console.log(`Copying "${PACKAGE}" into "public/bevy-engine"...`);

// Try to find the engine package at different levels (workspace hoists to root).
// `engine/boot.js` marks the react-web layout our host page boots against.
const possiblePaths = [
  resolve(__dirname, `../node_modules/${PACKAGE}`), // packages/inspector level
  resolve(__dirname, `../../../node_modules/${PACKAGE}`), // root level
];

let sourceDir: string | null = null;
for (const path of possiblePaths) {
  if (fs.existsSync(resolve(path, 'engine', 'boot.js'))) {
    sourceDir = path;
    console.log(`Found ${PACKAGE} at: ${path}`);
    break;
  }
}

if (!sourceDir) {
  throw new Error(
    `Could not find ${PACKAGE} (with engine/boot.js) at packages/inspector or root ` +
      'level. Run `npm install`.',
  );
}

const destDir = resolve(__dirname, '../public/bevy-engine');

// Fresh copy each build so a bumped engine version can't leave stale files behind.
fs.rmSync(destDir, { recursive: true, force: true });
fs.cpSync(sourceDir, destDir, {
  recursive: true,
  // Skip the package's own node_modules and package.json — we serve engine
  // assets, not a package.
  filter: src => !src.includes(`${PACKAGE}/node_modules`),
});

// Add our host page. The engine boots into THIS document (same-origin) rather
// than the package's CDN React HUD.
const hostSrc = resolve(__dirname, 'bevy-engine-host');
fs.cpSync(hostSrc, destDir, { recursive: true });

console.log(`Copied bevy engine bundle + host page → ${destDir}`);
