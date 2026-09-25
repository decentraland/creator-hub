import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SCENES_DIRECTORY } from '../../shared/paths';
import { expect, test } from '../fixtures';
import { creatorHubDir } from '../helpers/app';
import { EditorPage } from '../pages/EditorPage';
import { ScenesPage } from '../pages/ScenesPage';

/** A `.glb` shipped in the repo, imported from outside the project to cover a filesystem import. */
const FIXTURE_GLB = join(creatorHubDir, '..', 'asset-packs/packs/western/assets/door_5/Door 5.glb');

/** Finds the scene directory the app created under `<userDataDir>/Scenes`. */
function findSceneDir(userDataDir: string): string | null {
  const stack = [join(userDataDir, SCENES_DIRECTORY)];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    if (entries.includes('scene.json')) return dir;
    for (const entry of entries) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const child = join(dir, entry);
      try {
        if (statSync(child).isDirectory()) stack.push(child);
      } catch {
        continue;
      }
    }
  }
  return null;
}

/** Waits until a `.glb` appears anywhere under the scene directory. */
function sceneHasGlb(sceneDir: string): boolean {
  const stack = [sceneDir];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    if (entries.some(entry => entry.toLowerCase().endsWith('.glb'))) return true;
    for (const entry of entries) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const child = join(dir, entry);
      try {
        if (statSync(child).isDirectory()) stack.push(child);
      } catch {
        continue;
      }
    }
  }
  return false;
}

test.describe('scene assets', { tag: '@scene' }, () => {
  test('creates a scene and imports a .glb from the filesystem', async ({ page, userDataDir }) => {
    const scenes = new ScenesPage(page);
    const editor = new EditorPage(page);

    expect(existsSync(FIXTURE_GLB), `fixture missing: ${FIXTURE_GLB}`).toBe(true);

    await scenes.createBlankScene();
    await editor.waitReady();

    const sceneDir = await test.step('locate the created scene', async () => {
      let dir: string | null = null;
      await expect
        .poll(() => (dir = findSceneDir(userDataDir)) !== null, {
          message: 'no directory containing scene.json appeared under <userDataDir>/Scenes',
          timeout: 120_000,
        })
        .toBe(true);
      return dir!;
    });

    await editor.importGlb(FIXTURE_GLB);

    await expect
      .poll(() => sceneHasGlb(sceneDir), {
        message: `no .glb was written under the scene at ${sceneDir}`,
        timeout: 120_000,
      })
      .toBe(true);
  });
});
