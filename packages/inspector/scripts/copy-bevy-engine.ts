import fs from 'fs';
import { resolve } from 'path';

// Copy the prebuilt bevy-explorer web bundle (engine wasm + JS glue + index.html)
// into the inspector's served `public/bevy-engine/` dir. The Bevy renderer mounts
// this in a same-origin iframe; the browser only enables the wasm's
// SharedArrayBuffer threads when the document is served with COOP/COEP, which the
// dev server (build.js) stamps on. Kept out of git (see .gitignore) — it's a
// large (~100MB) build artifact copied from the installed npm package, exactly
// like `public/bin` is copied from @dcl/asset-packs.

const PACKAGE = '@dcl-regenesislabs/bevy-explorer-web';

console.log(`Copying "${PACKAGE}" into "public/bevy-engine"...`);

// try to find the engine package at different levels (workspace hoists to root)
const possiblePaths = [
  resolve(__dirname, `../node_modules/${PACKAGE}`), // packages/inspector level
  resolve(__dirname, `../../../node_modules/${PACKAGE}`), // root level
];

let sourceDir: string | null = null;
for (const path of possiblePaths) {
  if (fs.existsSync(resolve(path, 'index.html'))) {
    sourceDir = path;
    console.log(`Found ${PACKAGE} at: ${path}`);
    break;
  }
}

if (!sourceDir) {
  throw new Error(
    `Could not find ${PACKAGE} at packages/inspector or root level. Run \`npm install\`.`,
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

console.log(`Copied bevy engine bundle → ${destDir}`);
