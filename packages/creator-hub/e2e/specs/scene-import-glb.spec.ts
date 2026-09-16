import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SCENES_DIRECTORY } from '../../shared/paths';
import { expect, test } from '../fixtures';
import { creatorHubDir } from '../helpers/app';

/**
 * A `.glb` that already ships in the repo. Importing one from outside the project is the
 * journey nothing covers today: the inspector's own `Assets.spec.ts` looks like it does, but
 * it drags a tile that is *already in the project* onto the canvas, so no file ever enters
 * from the filesystem.
 */
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

/**
 * `@scene`, not `@offline`: `createProjectAndInstall` dispatches `installProject` ->
 * `npm.install` into the new scene folder, so a live npm process runs alongside these tests
 * and they can fail because the registry is slow rather than because the app broke. The
 * install is fire-and-forget, so nothing here awaits it — the editor only needs
 * `!!project && inspectorPort > 0` (EditorPage:140), not installed dependencies.
 */
test.describe('scene assets', { tag: '@scene' }, () => {
  test('creates a scene and imports a .glb from the filesystem', async ({ page, userDataDir }) => {
    expect(existsSync(FIXTURE_GLB), `fixture missing: ${FIXTURE_GLB}`).toBe(true);

    await page.locator('[data-testid="navbar-menu-scenes"]').click();
    await expect(page.locator('[data-testid="scenes-page"]')).toBeVisible();

    await page.locator('[data-testid="scene-list-new-scene-button"]').click();
    await expect(page.locator('[data-testid="templates-page"]')).toBeVisible();

    await page.locator('[data-testid="templates-page-new-scene-button"]').click();

    await expect(page.locator('[data-testid="create-project-modal"]')).toBeVisible();
    await page.locator('[data-testid="create-project-modal-create-button"]').click();

    await expect(page.locator('[data-testid="editor-page"]')).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('[data-testid="editor-page-iframe"]')).toBeVisible();

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

    await expect(page.locator('.MuiBackdrop-root:visible')).toHaveCount(0, { timeout: 240_000 });

    const inspector = page.frameLocator('[data-testid="editor-page-iframe"]');
    const fileInput = inspector.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 120_000 });
    await fileInput.setInputFiles(FIXTURE_GLB);

    await inspector
      .locator('.ImportAssetModal')
      .getByRole('button', { name: /^IMPORT/ })
      .click({ timeout: 120_000 });

    await expect
      .poll(
        () => {
          const stack = [sceneDir];
          while (stack.length) {
            const dir = stack.pop()!;
            let entries: string[];
            try {
              entries = readdirSync(dir);
            } catch {
              continue;
            }
            if (entries.some(e => e.toLowerCase().endsWith('.glb'))) return true;
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
        },
        {
          message: `no .glb was written under the scene at ${sceneDir}`,
          timeout: 120_000,
        },
      )
      .toBe(true);
  });
});
