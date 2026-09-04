/**
 * Ensures the packaged app ships a loadable `sharp` native binding for the macOS arch being
 * built, plus its matching libvips.
 *
 * Why: sharp's native code lives in per-platform OPTIONAL dependencies
 * (@img/sharp-darwin-x64 / -arm64, each pairing with @img/sharp-libvips-darwin-<arch>),
 * gated by os/cpu. npm installs only the ones matching the build host, so a `macos-latest`
 * (arm64) runner never installs the Intel binding. electron-builder then packs BOTH the arm64
 * and x64 dmgs from that single node_modules, and the Intel dmg would ship with no sharp
 * binding — the optimizer's main-process code would throw on first use.
 *
 * This is the exact trap #1545 fixed for oxc-parser; this script mirrors
 * provision-oxc-bindings.js. beforePack runs once per target arch, so we fetch the matching
 * darwin binding (and its libvips) straight from their npm tarballs into node_modules.
 * (`npm install --force` would reconcile/prune the whole workspace tree right before
 * packaging; `npm pack` touches only its own temp cwd.)
 *
 * The exact versions come from sharp's own optionalDependencies map, which pins the binding
 * to sharp's version and libvips to its independent version.
 *
 * Only needed on macOS: Windows/Linux artifacts build on their own native runners, where npm
 * installs the correct binding on its own.
 *
 * Runs as part of the electron-builder `beforePack` hook, once per target arch.
 */
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFileSync } from 'child_process';

function archName(context) {
  const raw = context.arch;
  if (typeof raw === 'string') return raw;
  const names = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64', 4: 'universal' };
  return names[raw] ?? os.arch();
}

/**
 * Downloads a single npm package tarball and extracts it into destDir. `npm pack` writes only
 * to its own temp cwd, so this never reconciles or prunes the workspace's node_modules tree.
 * No-op when the sentinel file (proof the package is already present) already exists.
 */
function ensurePackage(spec, destDir, sentinel) {
  if (fs.existsSync(path.join(destDir, sentinel))) return false;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-sharp-'));
  try {
    execFileSync('npm', ['pack', spec], { cwd: tmp, stdio: ['ignore', 'ignore', 'inherit'] });
    const tgz = fs.readdirSync(tmp).find(f => f.endsWith('.tgz'));
    if (!tgz) throw new Error(`provision-sharp-bindings: npm pack produced no tarball for ${spec}`);
    fs.mkdirSync(destDir, { recursive: true });
    execFileSync('tar', ['-xzf', path.join(tmp, tgz), '-C', destDir, '--strip-components=1']);
    return true;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export default async function provisionSharpBindings(context) {
  const electronPlatform = context.electronPlatformName ?? process.platform;
  if (electronPlatform !== 'darwin' && electronPlatform !== 'mas') return;

  const arch = archName(context);
  if (arch !== 'x64' && arch !== 'arm64') {
    throw new Error(`provision-sharp-bindings: unexpected macOS arch ${arch}`);
  }

  const appDir = context.appDir ?? context.packager?.info?.appDir;
  if (!appDir) {
    console.warn('provision-sharp-bindings: no appDir in context');
    return;
  }
  const rootDir = path.resolve(appDir, '../..');
  const imgDir = path.join(rootDir, 'node_modules/@img');

  const sharpPkg = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'node_modules/sharp/package.json'), 'utf8'),
  );
  const optionalDeps = sharpPkg.optionalDependencies ?? {};

  const bindingName = `sharp-darwin-${arch}`;
  const libvipsName = `sharp-libvips-darwin-${arch}`;
  const bindingVersion = optionalDeps[`@img/${bindingName}`] ?? sharpPkg.version;
  const libvipsVersion = optionalDeps[`@img/${libvipsName}`];

  if (
    ensurePackage(
      `@img/${bindingName}@${bindingVersion}`,
      path.join(imgDir, bindingName),
      `lib/${bindingName}.node`,
    )
  ) {
    console.log(`provision-sharp-bindings: added @img/${bindingName}@${bindingVersion}`);
  }

  if (libvipsVersion) {
    if (
      ensurePackage(
        `@img/${libvipsName}@${libvipsVersion}`,
        path.join(imgDir, libvipsName),
        'package.json',
      )
    ) {
      console.log(`provision-sharp-bindings: added @img/${libvipsName}@${libvipsVersion}`);
    }
  }

  // The native binding for this arch MUST be present or the packaged app throws on first use.
  const nativePath = path.join(imgDir, bindingName, 'lib', `${bindingName}.node`);
  if (!fs.existsSync(nativePath)) {
    throw new Error(`provision-sharp-bindings: missing ${nativePath} for darwin-${arch}`);
  }
}
