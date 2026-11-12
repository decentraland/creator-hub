/**
 * Regenerates the session recorder's speech-to-text lockfiles from its pinned package.json:
 *   main/src/modules/recording/tools/recording-tools.package.json   (edit the version here)
 *   main/src/modules/recording/tools/<platform>-<arch>.package-lock.json (generated, commit them)
 *
 * `@fugood/whisper.node` lists every native build as an optionalDependency, including CUDA
 * (~125 MB) and Vulkan (~42 MB) variants for Windows. The app installs with `npm ci
 * --omit=optional` and makes the platform's plain CPU/Metal build a direct dependency instead,
 * so each platform gets its own lockfile pinning exactly that build (see recording/tools.ts,
 * `platformManifest`, which must produce the same package.json this script locks).
 * Run after bumping the version: `npm run lock:recording-tools`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLATFORMS = [
  ['darwin', 'arm64'],
  ['darwin', 'x64'],
  ['win32', 'x64'],
  ['win32', 'arm64'],
  ['linux', 'x64'],
  ['linux', 'arm64'],
];

const toolsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../main/src/modules/recording/tools',
);
const base = JSON.parse(
  fs.readFileSync(path.join(toolsDir, 'recording-tools.package.json'), 'utf8'),
);
const version = base.dependencies['@fugood/whisper.node'];

for (const [platform, arch] of PLATFORMS) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'recording-tools-'));
  try {
    const manifest = {
      ...base,
      dependencies: {
        ...base.dependencies,
        [`@fugood/node-whisper-${platform}-${arch}`]: version,
      },
    };
    fs.writeFileSync(path.join(tmp, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    // --force: the binding for another OS/CPU fails npm's platform check on this machine.
    execFileSync(
      'npm',
      [
        'install',
        '--package-lock-only',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--force',
        `--os=${platform}`,
        `--cpu=${arch}`,
      ],
      { cwd: tmp, stdio: 'inherit' },
    );
    fs.copyFileSync(
      path.join(tmp, 'package-lock.json'),
      path.join(toolsDir, `${platform}-${arch}.package-lock.json`),
    );
    console.log(`updated ${platform}-${arch}.package-lock.json`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
