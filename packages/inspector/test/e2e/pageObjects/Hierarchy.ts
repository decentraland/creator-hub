import { type Page } from 'playwright';
import { type Positions, dragAndDrop } from '../utils/drag-and-drop';

declare const page: Page;

class HierarchyPageObject {
  getParentSelectorById(entityId: number) {
    return `.Hierarchy .Tree.is-parent[data-test-id="${entityId}"]`;
  }

  getItemSelectorById(entityId: number) {
    return `.Hierarchy .Tree[data-test-id="${entityId}"] .item`;
  }

  getItemAreaSelectorById(entityId: number) {
    return `${this.getItemSelectorById(entityId)} .item-area`;
  }

  getTreeSelectorByLabel(label: string) {
    return `.Hierarchy .Tree[data-test-label="${label}"]`;
  }

  async toggleOpen(entityId: number) {
    const arrowSelector = (entityId: number) => `${this.getItemAreaSelectorById(entityId)} > svg`;
    const arrow = await this.getItem(entityId, arrowSelector);
    await arrow.click();
  }

  async getItem(entityId: number, selector: (entityId: number) => string) {
    const item = await page.$(selector(entityId));
    if (!item) {
      throw new Error(`Could not find entity with id=${entityId}`);
    }
    return item;
  }

  // Wait for the tree row to render before reading its id — engine commits
  // land before React paints, so a sync read races the render.
  async getId(label: string, timeout = 5_000) {
    const selector = this.getTreeSelectorByLabel(label);
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ state: 'attached', timeout });
    } catch {
      throw new Error(`Could not find entity with label="${label}"`);
    }
    const id = await locator.getAttribute('data-test-id');
    if (!id) {
      throw new Error(`Could not find entity with label="${label}"`);
    }
    return +id;
  }

  async getChildrenIds(parent: number, selector: string) {
    const parentNode = await this.getItem(parent, this.getParentSelectorById);
    const ids = await parentNode.$$eval(selector, elements => {
      return elements.map($ => +($.getAttribute('data-test-id') || NaN));
    });
    return ids;
  }

  async setParent(
    entityId: number,
    parent: number,
    positions: Positions = { x: 'inside', y: 'inside' },
  ) {
    await dragAndDrop(
      this.getItemAreaSelectorById(entityId),
      this.getItemAreaSelectorById(parent),
      positions,
    );
  }

  async isAncestor(entityId: number, parent: number) {
    const item = await page.$(
      `${this.getParentSelectorById(parent)} ${this.getItemSelectorById(entityId).replace('.Hierarchy', '')}`,
    );
    return item !== null;
  }

  async hasChildrenInOrder(parent: number, ...childrenIds: number[]) {
    const ids = await this.getChildrenIds(parent, '.Tree');
    if (ids.length !== childrenIds.length) return false;
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] !== childrenIds[i]) return false;
    }
    return true;
  }

  async getLabel(entityId: number) {
    const item = await this.getItem(entityId, this.getItemSelectorById);
    const label = await item.evaluate(el => el.textContent);
    return label || '';
  }

  // Open the row's context menu and click an item, resiliently.
  //
  // Opening a contexify menu needs a `contextmenu` event to land on a stable
  // row. Right after a tree mutation the row can still be remounting, so a
  // single right-click is sometimes swallowed (the menu never opens) or the
  // menu opens and is torn down when its anchor row remounts — leaving the
  // item never "visible". Re-issue the right-click (re-resolving the row
  // locator each time, per the locators-over-handles rule) until the item is
  // actually visible, then click it. Short per-attempt timeouts make a missed
  // attempt fall through to a retry quickly; Playwright's click auto-waits for
  // row stability, so the loop paces itself against the remount.
  private async openContextMenuItem(entityId: number, itemId: string, action: string) {
    const rowSelector = this.getItemSelectorById(entityId);
    const itemSelector = `.contexify_item[itemid="${itemId}"]`;
    const deadline = Date.now() + 8_000;
    let lastError: unknown;
    while (Date.now() < deadline) {
      try {
        await page.locator(rowSelector).first().click({ button: 'right', timeout: 2_000 });
        await page.waitForSelector(itemSelector, { state: 'visible', timeout: 1_500 });
        await page.click(itemSelector, { timeout: 1_500 });
        return;
      } catch (error) {
        lastError = error;
        // Menu didn't open or was torn down mid-flight; dismiss any partial
        // menu so the next right-click opens a fresh one, then retry.
        await page.keyboard.press('Escape').catch(() => {});
      }
    }
    throw new Error(
      `Can't ${action} entity with id=${entityId}: context-menu item "${itemId}" not clickable (${
        lastError instanceof Error ? lastError.message : String(lastError)
      })`,
    );
  }

  // Post-mutation sync point: wait for the new row to land in the DOM.
  private async waitForLabel(label: string, timeout = 5_000) {
    await page.locator(this.getTreeSelectorByLabel(label)).first().waitFor({
      state: 'attached',
      timeout,
    });
  }

  // Gate typing on `document.activeElement` actually being the Input —
  // mount-visible isn't enough since the Input's onBlur unmounts itself.
  private async typeIntoTreeInput(value: string, timeout = 5_000) {
    const input = page.locator('input.Input').first();
    await input.waitFor({ state: 'visible', timeout });
    await page.waitForFunction(
      () =>
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.classList.contains('Input'),
      undefined,
      { timeout },
    );
    await page.keyboard.type(value);
  }

  async rename(entityId: number, newLabel: string) {
    await this.openContextMenuItem(entityId, 'rename', 'rename');

    // Rename's Input is pre-filled; select-all so keystrokes replace, not append.
    await page.locator('input.Input').first().waitFor({ state: 'visible', timeout: 5_000 });
    await page.waitForFunction(
      () =>
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.classList.contains('Input'),
      undefined,
      { timeout: 5_000 },
    );
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(newLabel);
    await page.keyboard.press('Enter');
    await this.waitForLabel(newLabel);
  }

  async addChild(entityId: number, label: string) {
    await this.openContextMenuItem(entityId, 'add-child', 'add child to');
    await this.typeIntoTreeInput(label);
    await page.keyboard.press('Enter');
    await this.waitForLabel(label);
  }

  async duplicate(entityId: number) {
    const beforeCount = await page.locator('.Hierarchy .Tree').count();
    await this.openContextMenuItem(entityId, 'duplicate', 'duplicate');
    // Wait for the new subtree to render before returning.
    await page
      .waitForFunction(
        ({ selector, expected }) => document.querySelectorAll(selector).length > expected,
        { selector: '.Hierarchy .Tree', expected: beforeCount },
        { timeout: 5_000 },
      )
      .catch(() => {});
  }

  async remove(entityId: number) {
    await this.openContextMenuItem(entityId, 'delete', 'delete');
    await page
      .locator(this.getItemSelectorById(entityId))
      .waitFor({ state: 'detached', timeout: 5_000 })
      .catch(() => {});
  }

  async exists(entityId: number) {
    try {
      await this.getItem(entityId, this.getItemSelectorById);
      return true;
    } catch (error) {
      return false;
    }
  }

  async selectMultiple(entityIds: number[]) {
    // Close any open context menus first by clicking outside
    await page.click('body', { position: { x: 0, y: 0 } });
    await page.keyboard.press('Escape');

    try {
      await page.waitForSelector('.contexify', { state: 'hidden', timeout: 5000 });
    } catch (error) {
      /* empty */
    }

    const firstItem = await this.getItem(entityIds[0], this.getItemSelectorById);
    await firstItem.click();

    for (let i = 1; i < entityIds.length; i++) {
      const item = await this.getItem(entityIds[i], this.getItemSelectorById);
      await page.keyboard.down('ControlOrMeta');
      await item.click();
      await page.keyboard.up('ControlOrMeta');
    }
  }

  async addComponent(entityId: number, componentName: string) {
    const item = await this.getItem(entityId, this.getItemSelectorById);
    await item.click({ button: 'right' });
    const addComponent = await item.$('.contexify_item[itemid="add-component"]');
    if (!addComponent) {
      throw new Error(`Can't add components on entity with id=${entityId}`);
    }
    await addComponent.click();
    const component = await addComponent.$(`.contexify_item[itemid="${componentName}"]`);
    if (!component) {
      throw new Error(
        `Can't add component with componentName=${componentName} on entity with id=${entityId}`,
      );
    }
    await component.click();
  }
}

export const Hierarchy = new HierarchyPageObject();
