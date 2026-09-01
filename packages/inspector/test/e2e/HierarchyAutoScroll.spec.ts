import { type Page } from 'playwright';
import { App } from './pageObjects/App';
import { Hierarchy } from './pageObjects/Hierarchy';
import { installMouseHelper } from './utils/install-mouse-helper';

declare const page: Page;

const ROOT = 0;
const FILLER_COUNT = 10;

describe('Hierarchy auto-scroll to selection', () => {
  beforeAll(async () => {
    await installMouseHelper(page);
    // Page is already navigated in setup
    await App.waitUntilReady();
    // a short viewport so the tree overflows and scrolling is meaningful
    await page.setViewportSize({ width: 1280, height: 500 });
    for (let i = 1; i <= FILLER_COUNT; i++) {
      await Hierarchy.addChild(ROOT, `Filler ${i}`);
    }
    await Hierarchy.addChild(ROOT, 'Deep Group');
    const group = await Hierarchy.getId('Deep Group');
    await Hierarchy.addChild(group, 'Deep Child');
  });

  test('pressing F scrolls the tree back to the selected entity', async () => {
    const child = await Hierarchy.getId('Deep Child');

    await page.locator(Hierarchy.getItemSelectorById(child)).click();
    await page.waitForSelector(`${Hierarchy.getItemSelectorById(child)}.selected`, {
      timeout: 5_000,
    });

    // scroll the tree away from the selection
    await Hierarchy.scrollTreeToTop();
    await expect(Hierarchy.isRowInTreeViewport(child)).resolves.toBe(false);

    await page.keyboard.press('f');

    await Hierarchy.waitForRowInTreeViewport(child);
  });

  test('pressing F re-opens collapsed ancestors so the selected entity is shown', async () => {
    const group = await Hierarchy.getId('Deep Group');
    const child = await Hierarchy.getId('Deep Child');

    // "Deep Child" is still selected from the previous test; collapsing its
    // parent unmounts its row entirely
    await Hierarchy.toggleOpen(group);
    await page
      .locator(Hierarchy.getItemSelectorById(child))
      .waitFor({ state: 'detached', timeout: 5_000 });

    await page.keyboard.press('f');

    await page
      .locator(`${Hierarchy.getItemSelectorById(child)}.selected`)
      .waitFor({ state: 'attached', timeout: 5_000 });
    await Hierarchy.waitForRowInTreeViewport(child);
  });
});
