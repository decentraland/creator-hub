/**
 * Copies root monorepo node_modules/npm into app dir so electron-builder 26.4.1+
 * asarUnpack (which matches paths relative to app dir) sees npm and creates app.asar.unpacked.
 * Used as electron-builder beforePack hook (beforeBuild only runs when npmRebuild !== false).
 */
import path from 'path';
import fs from 'fs';

export default async function copyNpmForAsar(context) {
  const appDir = context.appDir ?? context.packager?.info?.appDir;
  if (!appDir) {
    console.warn('copy-npm-for-asar: no appDir in context');
    return;
  }
  const rootDir = path.resolve(appDir, '../..');
  const src = path.join(rootDir, 'node_modules/npm');
  const dest = path.join(appDir, 'node_modules/npm');

  if (!fs.existsSync(src)) {
    console.warn('copy-npm-for-asar: source not found, skipping:', src);
    return;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true });
  }
  fs.cpSync(src, dest, { recursive: true });

  const nestedSrc = path.join(rootDir, 'node_modules/npm/node_modules');
  const nestedDest = path.join(appDir, 'node_modules/npm/node_modules');
  if (fs.existsSync(nestedSrc)) {
    fs.mkdirSync(path.dirname(nestedDest), { recursive: true });
    if (fs.existsSync(nestedDest)) {
      fs.rmSync(nestedDest, { recursive: true });
    }
    fs.cpSync(nestedSrc, nestedDest, { recursive: true });
  }

  console.log('copy-npm-for-asar: copied npm into app dir for asar unpack');
}
