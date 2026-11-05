import { type Page } from 'playwright';
import type { AssetsTab } from '../../../src/redux/ui/types';
import { dragAndDrop } from '../utils/drag-and-drop';
import { actUntil } from '../utils/interactions';
import { sleep } from '../utils/sleep';

declare const page: Page;

class AssetsPageObject {
  async selectTab(tab: AssetsTab) {
    const trigger = page.locator(`.Assets .tab[data-test-id="${tab}"]`);
    await actUntil(
      () => trigger.click(),
      () => trigger.locator('.underlined').waitFor({ state: 'attached', timeout: 2_000 }),
    );
  }

  async selectAssetPack(assetPack: string) {
    const trigger = page.locator(`.Assets .theme[data-test-label="${assetPack}"]`);
    await actUntil(
      () => trigger.click(),
      () =>
        page
          .locator('.Assets .assets-catalog-asset')
          .first()
          .waitFor({ state: 'attached', timeout: 5_000 }),
    );
  }

  private async waitForRenderer() {
    // simulate a mouse move to trigger the onPointerObservable from getPointerCoords in mouse-utils.ts
    const renderer = await page.$('.Renderer canvas');
    const box = await renderer!.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    // wait for renderer to load
    await sleep(32);
    if (await page.$('.Renderer.is-loading')) {
      // Wait for the in-progress load to FINISH (indicator detaches), not to
      // appear. The indicator can disappear between the check above and here,
      // which made the default "wait for visible" hang until timeout — the
      // deterministic cause of the `.Renderer.is-loading ... 30000ms` failures.
      await page.waitForSelector('.Renderer.is-loading', { state: 'detached', timeout: 60_000 });
    }
    await page.waitForSelector('.Renderer.is-loaded', { timeout: 60_000 });
  }

  async addBuilderAsset(asset: string) {
    await dragAndDrop(
      `.Assets .assets-catalog-asset[data-test-label="${asset}"]`,
      '.Renderer canvas',
    );
    await this.waitForRenderer();
  }

  async search(term: string) {
    await page.fill('.Assets .assets-catalog-header-search input', term);
    await page.waitForSelector(`.Assets .assets-catalog-asset[data-test-label="${term}"]`);
  }

  /** Gap between the name tooltip's bottom and the tile, and its clearance below the panel header. */
  async getNameTooltipPlacement(asset: string) {
    const tile = page.locator(`.Assets .assets-catalog-asset[data-test-label="${asset}"]`).first();
    await tile.hover();
    const tooltip = page.locator('.ui.popup.InfoTooltip').first();
    await tooltip.waitFor({ state: 'visible', timeout: 5_000 });
    const header = page.locator('.Assets .assets-catalog-header-title').first();
    const [tileBox, tooltipBox, headerBox] = await Promise.all([
      tile.boundingBox(),
      tooltip.boundingBox(),
      header.boundingBox(),
    ]);
    await page.mouse.move(0, 0);
    return {
      gapAbove: tileBox!.y - (tooltipBox!.y + tooltipBox!.height),
      clearsHeaderBy: tooltipBox!.y - (headerBox!.y + headerBox!.height),
    };
  }

  async openFolder(path: string) {
    const element = await page.$(`.FolderView .Tile[data-test-id="${path}"]`);
    if (element) {
      await element.click({ clickCount: 2 });
    }
  }

  async addFileSystemAssetFromTree(path: string) {
    await dragAndDrop(
      `.editor-assets-tree .Tree[data-test-id="${path}"] .item-area`,
      '.Renderer canvas',
    );
    await this.waitForRenderer();
  }

  async addFileSystemAsset(path: string) {
    await dragAndDrop(`.FolderView .Tile[data-test-id="${path}"]`, '.Renderer canvas');
    await this.waitForRenderer();
  }
}

export const Assets = new AssetsPageObject();
