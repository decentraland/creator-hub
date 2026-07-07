import { type Page } from 'playwright';
import type { AssetsTab } from '../../../src/redux/ui/types';
import { dragAndDrop } from '../utils/drag-and-drop';
import { sleep } from '../utils/sleep';

declare const page: Page;

class AssetsPageObject {
  async selectTab(tab: AssetsTab) {
    const element = await page.$(`.Assets .tab[data-test-id="${tab}"]`);
    if (element) {
      await element.click();
    }
  }

  async selectAssetPack(assetPack: string) {
    const element = await page.$(`.Assets .theme[data-test-label="${assetPack}"]`);
    if (element) {
      await element.click();
    }
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

  async openFolder(path: string) {
    const element = await page.$(`.FolderView .Tile[data-test-id="${path}"]`);
    if (element) {
      await element.click({ clickCount: 2 });
    }
  }

  async addFileSystemAsset(path: string) {
    await dragAndDrop(`.FolderView .Tile[data-test-id="${path}"]`, '.Renderer canvas');
    await this.waitForRenderer();
  }
}

export const Assets = new AssetsPageObject();
