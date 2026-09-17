import { type Page } from 'playwright';
import { actUntil, openThenSelect, revealThenClick } from '../utils/interactions';

declare const page: Page;

const RAIL = '.ui-designer-left-rail';
const TREE = '.ui-designer-nodetree';
const ROOT_ROW = '.ui-designer-code-root-row';

const exactly = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

class UIDesignerPageObject {
  readonly railSelector = RAIL;
  readonly treeSelector = TREE;
  readonly rootRowSelector = ROOT_ROW;
  readonly emptyStateSelector = '.ui-designer-canvas-empty .ui-designer-empty-state';

  /** Open 2D mode and wait for the rail to mount. */
  async open() {
    const tab = page.locator('[role="tab"]', { hasText: '2D' }).first();
    await actUntil(
      () => tab.click(),
      () => page.locator(RAIL).waitFor({ state: 'attached', timeout: 3_000 }),
    );
  }

  nodeRowSelector(label: string) {
    return `${TREE} .Tree[data-test-label="${label}"] > .item`;
  }

  rootRow(name: string) {
    return page
      .locator(ROOT_ROW)
      .filter({ has: page.locator('.ui-designer-code-root-name', { hasText: exactly(name) }) });
  }

  pickerRow(widget: string) {
    return page.locator('.ui-designer-widget-picker-row').filter({ hasText: exactly(widget) });
  }

  /** Displayed node labels, in tree order. */
  async nodeLabels() {
    return page
      .locator(`${TREE} .Tree[data-test-label]`)
      .evaluateAll(els => els.map(el => el.getAttribute('data-test-label') ?? ''));
  }

  /** Displayed GUI names, in list order. */
  async rootNames() {
    return page
      .locator(`${RAIL} .ui-designer-code-root-name`)
      .evaluateAll(els => els.map(el => el.textContent ?? ''));
  }

  async isSectionVisible(title: 'GUIs' | 'Nodes') {
    return (await page.locator(`${RAIL} .ui-designer-rail-header`, { hasText: title }).count()) > 0;
  }

  async search(term: string) {
    const input = page.locator(`${RAIL} input`).first();
    await actUntil(
      () => input.click(),
      () =>
        page.waitForFunction(() => document.activeElement instanceof HTMLInputElement, undefined, {
          timeout: 2_000,
        }),
    );
    await input.press('ControlOrMeta+a');
    await page.keyboard.type(term);
  }

  async clearSearch() {
    await page.locator(`${RAIL} .ClearSearch`).click();
  }

  async createRoot() {
    await page.locator(`${RAIL} [aria-label="New GUI"]`).click();
  }

  /** The empty state's own call to action. */
  async createRootFromEmptyState() {
    const button = page.locator(`${this.emptyStateSelector} button`);
    await actUntil(
      () => button.click(),
      () => page.locator(this.emptyStateSelector).waitFor({ state: 'detached', timeout: 3_000 }),
    );
  }

  /** Deletes via the row's trash, which is only visible while the row is hovered. */
  async removeRoot(name: string) {
    const row = this.rootRow(name);
    await revealThenClick(row, row.locator(`[aria-label="Delete ${name}"]`), () =>
      row.waitFor({ state: 'detached', timeout: 3_000 }),
    );
  }

  /** Add a widget under the current selection via the Nodes "+" picker. */
  async addWidget(widget: 'Container' | 'Image' | 'Label' | 'Button' | 'Input' | 'Dropdown') {
    const before = (await this.nodeLabels()).length;
    const trigger = page.locator(`${RAIL} [aria-label="Add widget"]`);
    const row = this.pickerRow(widget);
    await openThenSelect(
      trigger,
      row,
      () =>
        page.waitForFunction(
          ([selector, count]) =>
            document.querySelectorAll(selector as string).length > (count as number),
          [`${TREE} .Tree[data-test-label]`, before] as const,
          { timeout: 5_000 },
        ),
      { opened: () => row.waitFor({ state: 'visible', timeout: 3_000 }) },
    );
  }

  async selectNode(label: string) {
    await page.locator(`${this.nodeRowSelector(label)} .selectable-area`).click();
  }

  async toggleHidden(label: string) {
    const rowSelector = this.nodeRowSelector(label);
    const before = await this.isNodeHidden(label);
    const row = page.locator(rowSelector);
    const button = page.locator(
      `${rowSelector} [aria-label="Hide node"], ${rowSelector} [aria-label="Show node"]`,
    );
    await revealThenClick(row, button, () =>
      page.waitForFunction(
        ([selector, was]) =>
          document.querySelectorAll(`${selector as string} .action-area.is-hidden`).length > 0 !==
          (was as boolean),
        [rowSelector, before] as const,
        { timeout: 3_000 },
      ),
    );
  }

  async isNodeHidden(label: string) {
    return (
      (await page.locator(`${this.nodeRowSelector(label)} .action-area.is-hidden`).count()) > 0
    );
  }

  /** The row context menu's entries, e.g. to assert Rename is not offered. */
  async contextMenuItems(label: string) {
    const trigger = page.locator(`${this.nodeRowSelector(label)} .selectable-area`);
    await actUntil(
      async () => {
        await page.keyboard.press('Escape').catch(() => {});
        await trigger.click({ button: 'right' });
      },
      () => page.locator('role=menuitem').first().waitFor({ state: 'visible', timeout: 2_000 }),
      { retries: 4 },
    );
    const items = await page.locator('role=menuitem').allTextContents();
    await page.keyboard.press('Escape');
    return items.map(t => t.trim());
  }

  async renameNode(label: string, next: string) {
    const trigger = page.locator(`${this.nodeRowSelector(label)} .selectable-area`);
    const rename = page.locator('role=menuitem[name="Rename"]');
    const input = page.locator(`${TREE} input`).first();
    await openThenSelect(
      trigger,
      rename,
      () => input.waitFor({ state: 'visible', timeout: 3_000 }),
      {
        triggerButton: 'right',
        opened: () => rename.waitFor({ state: 'visible', timeout: 2_000 }),
        reset: () => page.keyboard.press('Escape').catch(() => {}),
        retries: 4,
      },
    );
    await page.waitForFunction(
      () => document.activeElement instanceof HTMLInputElement,
      undefined,
      {
        timeout: 5_000,
      },
    );
    await input.press('ControlOrMeta+a');
    await page.keyboard.type(next);
    await page.keyboard.press('Enter');
    await page.locator(this.nodeRowSelector(next)).waitFor({ state: 'attached', timeout: 10_000 });
  }
}

export const UIDesigner = new UIDesignerPageObject();
