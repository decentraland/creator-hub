import fs from 'fs';
import { resolve } from 'path';

console.log('Copying "@dcl/asset-packs/bin/index.js" into "public/bin/index.js"...');

// try to find @dcl/asset-packs module at different levels
const possiblePaths = [
  resolve(__dirname, '../node_modules/@dcl/asset-packs/bin/index.js'), // packages/inspector level
  resolve(__dirname, '../../../node_modules/@dcl/asset-packs/bin/index.js'), // root level
];

let sourcePath: string | null = null;
for (const path of possiblePaths) {
  if (fs.existsSync(path)) {
    sourcePath = path;
    console.log(`Found @dcl/asset-packs at: ${path}`);
    break;
  }
}

if (!sourcePath) {
  throw new Error('Could not find @dcl/asset-packs module at packages/inspector or root level');
}

const binDirPath = resolve(__dirname, '../public/bin');
if (!fs.existsSync(binDirPath)) {
  fs.mkdirSync(binDirPath);
}

fs.copyFileSync(sourcePath, resolve(__dirname, '../public/bin/index.js'));
