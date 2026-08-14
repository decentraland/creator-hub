/**
 * Downloads a real Node.js binary into `node-bin/` so the packaged app can spawn scene
 * tooling on it instead of on Electron.
 *
 * Why: the Hub runs `sdk-commands` in an Electron utility process, where `process.execPath`
 * is the Electron Helper and `process.versions.electron` is set. sdk-commands passes that
 * same execPath down when it spawns the multiplayer server, so the server ends up on
 * Electron's module ABI (143) — and `isolated-vm`, which it depends on, only ships builds
 * for Node's ABIs. Handing it a real Node makes sdk-commands take its plain-Node code paths
 * on its own, with no changes needed on that side.
 *
 * Node 22 is pinned because its ABI (127) matches an `isolated-vm` prebuild, and because
 * @dcl/hammurabi-server refuses to run on any major other than 22 or 24.
 *
 * TEMPORARY: goes away once the multiplayer server drops `isolated-vm` (Bevy migration).
 *
 * Runs as part of the electron-builder `beforePack` hook, once per target arch.
 */
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';

const NODE_VERSION = 'v22.23.2';
const DIST_BASE = `https://nodejs.org/dist/${NODE_VERSION}`;

// electron-builder's platform names -> the ones nodejs.org uses.
const PLATFORMS = { darwin: 'darwin', mas: 'darwin', win32: 'win', linux: 'linux' };

/**
 * electron-builder hands us an Arch enum value, whose numeric ordering is not something we
 * want to depend on. Prefer the name when it is available.
 */
function archName(context) {
  const raw = context.arch;
  if (typeof raw === 'string') return raw;
  const names = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64', 4: 'universal' };
  return names[raw] ?? os.arch();
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * The published SHASUMS256.txt lists every artifact for the release; pick out the line for
 * the one we are downloading. A missing entry means we built the filename wrong, so treat
 * it as a failure rather than skipping the check.
 */
function expectedHash(shasums, archiveName) {
  const line = shasums.split('\n').find(l => l.trim().endsWith(` ${archiveName}`));
  if (!line) throw new Error(`no SHASUMS256 entry for ${archiveName}`);
  return line.trim().split(/\s+/)[0];
}

/**
 * Unpacks the archive whole, keeping the layout Node ships with.
 *
 * The layout is not incidental: npm derives its global prefix from `process.execPath` —
 * `dirname(dirname(execPath))` on unix, `dirname(execPath)` on Windows — and then expects
 * `<prefix>/lib/node_modules` (or `<prefix>/node_modules`) to exist. Shipping a bare binary in a
 * flat directory gives npm a prefix that points at nothing, and `npm exec` dies with ENOENT on
 * `lstat` the moment it looks at the global tree. Keeping the stock layout makes the prefix
 * correct by construction, and also lets sdk-commands' own `findNpxCliJs()` resolve npx from the
 * binary the same way it would for any normal Node install.
 */
function extract(archive, archiveName, destDir, isWindows) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ch-node-'));
  const archivePath = path.join(tmp, archiveName);
  fs.writeFileSync(archivePath, archive);

  try {
    fs.mkdirSync(destDir, { recursive: true });

    if (isWindows) {
      // unzip cannot strip leading path components, so unpack and lift the inner directory.
      execFileSync('unzip', ['-q', '-o', archivePath, '-d', tmp]);
      const stripped = path.basename(archiveName, '.zip');
      for (const entry of fs.readdirSync(path.join(tmp, stripped))) {
        fs.cpSync(path.join(tmp, stripped, entry), path.join(destDir, entry), {
          recursive: true,
        });
      }
    } else {
      execFileSync('tar', ['-xzf', archivePath, '-C', destDir, '--strip-components=1']);
    }

    // Headers and docs are a third of the download and are never read at runtime; node-gyp
    // fetches its own headers when something has to be compiled. `lib` / `node_modules` stay —
    // that is where npm lives, and npm's prefix resolution expects to find it there.
    for (const junk of ['include', 'share']) {
      fs.rmSync(path.join(destDir, junk), { recursive: true, force: true });
    }

    const dest = path.join(destDir, ...(isWindows ? ['node.exe'] : ['bin', 'node']));
    if (!fs.existsSync(dest)) throw new Error(`download-node: no binary at ${dest}`);
    if (!isWindows) fs.chmodSync(dest, 0o755);
    return dest;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * `isolated-vm` ships prebuilt binaries for every platform the Hub targets EXCEPT Intel Mac,
 * where it would otherwise try to compile from source (needs Xcode and a C++20 compiler,
 * which creators do not have). We vendor a cross-compiled one.
 *
 * node-gyp-build looks for a `prebuilds/` directory next to the running node binary once the
 * package's own lookup comes up empty, so dropping the file beside the binary is all it takes —
 * nothing has to patch the copy that npx installs at runtime. Note "beside the binary" means the
 * directory holding the executable itself, not the top of the install.
 *
 * Built with: npx node-gyp rebuild --release --arch=x64 --target=<NODE_VERSION minus the v>
 * from inside node_modules/isolated-vm, on any Mac. Rebuild if NODE_VERSION crosses a major.
 */
function copyVendoredPrebuilds(binaryDir, platform, arch) {
  if (platform !== 'darwin' || arch !== 'x64') return;

  const src = path.join(
    import.meta.dirname,
    'vendor',
    'isolated-vm',
    'darwin-x64',
    'isolated-vm.abi127.node',
  );
  if (!fs.existsSync(src)) {
    console.warn('download-node: vendored Intel Mac isolated-vm build missing, skipping:', src);
    return;
  }

  const prebuildDir = path.join(binaryDir, 'prebuilds', 'darwin-x64');
  fs.mkdirSync(prebuildDir, { recursive: true });
  fs.copyFileSync(src, path.join(prebuildDir, 'isolated-vm.abi127.node'));
  console.log('download-node: added vendored isolated-vm build for darwin-x64');
}

export default async function downloadNode(context) {
  const appDir = context.appDir ?? context.packager?.info?.appDir;
  if (!appDir) {
    console.warn('download-node: no appDir in context');
    return;
  }

  const electronPlatform = context.electronPlatformName ?? process.platform;
  const platform = PLATFORMS[electronPlatform];
  if (!platform) throw new Error(`download-node: unsupported platform ${electronPlatform}`);

  const arch = archName(context);
  const isWindows = platform === 'win';
  const archiveName = `node-${NODE_VERSION}-${platform}-${arch}.${isWindows ? 'zip' : 'tar.gz'}`;
  const destDir = path.join(appDir, 'node-bin');

  // beforePack runs once per arch and each run overwrites node-bin, so a stale binary from
  // the previous arch of a multi-arch build never survives into the wrong package.
  fs.rmSync(destDir, { recursive: true, force: true });

  console.log(`download-node: fetching ${archiveName}`);
  const [archive, shasums] = await Promise.all([
    fetchBuffer(`${DIST_BASE}/${archiveName}`),
    fetchBuffer(`${DIST_BASE}/SHASUMS256.txt`).then(b => b.toString('utf8')),
  ]);

  const expected = expectedHash(shasums, archiveName);
  const actual = createHash('sha256').update(archive).digest('hex');
  if (actual !== expected) {
    throw new Error(`download-node: checksum mismatch for ${archiveName}`);
  }

  const dest = extract(archive, archiveName, destDir, isWindows);
  copyVendoredPrebuilds(path.dirname(dest), electronPlatform, arch);
  console.log(`download-node: installed ${NODE_VERSION} ${platform}-${arch} at ${dest}`);
}
