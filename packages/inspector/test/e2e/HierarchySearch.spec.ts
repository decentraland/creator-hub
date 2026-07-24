import { type Page } from 'playwright';
import { App } from './pageObjects/App';
import { Hierarchy } from './pageObjects/Hierarchy';
import { installMouseHelper } from './utils/install-mouse-helper';

declare const page: Page;

const ROOT = 0;

describe('Hierarchy search', () => {
  beforeAll(async () => {
    await installMouseHelper(page);
    // Page is already navigated in setup
    await App.waitUntilReady();
    await Hierarchy.addChild(ROOT, 'Pine Tree');
    await Hierarchy.addChild(ROOT, 'House');
    await Hierarchy.addChild(ROOT, 'Group');
    const group = await Hierarchy.getId('Group');
    await Hierarchy.addChild(group, 'Bouncy Ball');
  });

  test('filter the tree to partial matches, case insensitively', async () => {
    const pine = await Hierarchy.getId('Pine Tree');
    const house = await Hierarchy.getId('House');

    await Hierarchy.search('TREE');

    await page
      .locator(Hierarchy.getItemSelectorById(house))
      .waitFor({ state: 'detached', timeout: 5_000 });
    await expect(Hierarchy.isRowVisible(pine)).resolves.toBe(true);

    await Hierarchy.clearSearch();
    await page
      .locator(Hierarchy.getItemSelectorById(house))
      .waitFor({ state: 'attached', timeout: 5_000 });
  });

  test('show the ancestors of a nested match and hide non-matching branches', async () => {
    const group = await Hierarchy.getId('Group');
    const ball = await Hierarchy.getId('Bouncy Ball');
    const pine = await Hierarchy.getId('Pine Tree');

    // collapse "Group" so the nested match must be revealed by the filter
    await Hierarchy.toggleOpen(group);
    await page
      .locator(Hierarchy.getItemSelectorById(ball))
      .waitFor({ state: 'detached', timeout: 5_000 });

    await Hierarchy.search('bouncy');

    await page
      .locator(Hierarchy.getItemSelectorById(ball))
      .waitFor({ state: 'attached', timeout: 5_000 });
    await expect(Hierarchy.isRowVisible(group)).resolves.toBe(true);
    await expect(Hierarchy.isRowVisible(pine)).resolves.toBe(false);
  });

  test('keep the selection visible and scrolled into view after clearing the search', async () => {
    // continues from the previous test: filter "bouncy" is active, "Group" is collapsed
    const ball = await Hierarchy.getId('Bouncy Ball');

    await page.locator(Hierarchy.getItemSelectorById(ball)).click();
    await page.waitForSelector(`${Hierarchy.getItemSelectorById(ball)}.selected`, {
      timeout: 5_000,
    });

    await Hierarchy.clearSearch();

    // the collapsed ancestor is re-opened so the selected row stays rendered and selected
    await page
      .locator(`${Hierarchy.getItemSelectorById(ball)}.selected`)
      .waitFor({ state: 'attached', timeout: 5_000 });
    await expect(Hierarchy.isRowInTreeViewport(ball)).resolves.toBe(true);
  });

  test('clear the search with the Escape key', async () => {
    const house = await Hierarchy.getId('House');

    await Hierarchy.search('tree');
    await page
      .locator(Hierarchy.getItemSelectorById(house))
      .waitFor({ state: 'detached', timeout: 5_000 });

    await page.keyboard.press('Escape');

    await page
      .locator(Hierarchy.getItemSelectorById(house))
      .waitFor({ state: 'attached', timeout: 5_000 });
  });
});
