import fs from 'node:fs';
import path from 'node:path';

/**
 * node-pty's `spawn-helper` (macOS/Linux) is exec'd by every pty spawn, but its 1.1.0 prebuild
 * ships it as 0644 and electron-builder copies that mode verbatim — so the packaged app can't
 * sign anyone in ("posix_spawnp failed"). Runtime code re-adds the exec bit too, but that needs
 * a writable install; do it here so the shipped bits are already correct. Runs after files are
 * assembled and before code signing, so the mode change is sealed by the signature.
 */
export default async function afterPack(context) {
  if (context.electronPlatformName === 'win32') return;

  const found = [];
  const walk = dir => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'spawn-helper') found.push(full);
    }
  };
  walk(context.appOutDir);

  for (const helper of found) {
    try {
      const { mode } = fs.statSync(helper);
      if ((mode & 0o111) === 0) {
        fs.chmodSync(helper, mode | 0o111);
        console.log(`  Made node-pty spawn-helper executable: ${helper}`);
      }
    } catch (error) {
      console.warn(`  Could not chmod ${helper}: ${error.message}`);
    }
  }
}
