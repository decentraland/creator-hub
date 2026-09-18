import { type Page } from 'playwright';

declare const page: Page;

const RAIL = '.ui-designer-left-rail';
const TREE = '.ui-designer-nodetree';
const ROOT_ROW = '.ui-designer-code-root-row';
const MOBILE_HUD_ROW = '.ui-designer-mobile-hud-row';
const MOBILE_HUD_PANEL = '.ui-designer-mobile-hud-panel';
const HUD_GUIDE = '.ui-designer-hud-guide';

const exactly = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

class UIDesignerPageObject {
  readonly railSelector = RAIL;
  readonly treeSelector = TREE;
  readonly rootRowSelector = ROOT_ROW;
  readonly mobileHudRowSelector = MOBILE_HUD_ROW;
  readonly mobileHudPanelSelector = MOBILE_HUD_PANEL;
  readonly hudGuideSelector = HUD_GUIDE;
  readonly emptyStateSelector = '.ui-designer-canvas-empty .ui-designer-empty-state';

  /** Open 2D mode and wait for the rail to mount. */
  async open() {
    await page.locator('[role="tab"]', { hasText: '2D' }).first().click();
    await page.locator(RAIL).waitFor({ state: 'attached', timeout: 10_000 });
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
    await input.click();
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
    await page.locator(`${this.emptyStateSelector} button`).click();
    await page.locator(this.emptyStateSelector).waitFor({ state: 'detached', timeout: 10_000 });
  }

  /** Deletes via the row's trash, which is only visible while the row is hovered. */
  async removeRoot(name: string) {
    const row = this.rootRow(name);
    await row.hover();
    await row.locator(`[aria-label="Delete ${name}"]`).click();
    await row.waitFor({ state: 'detached', timeout: 10_000 });
  }

  /** Add a widget under the current selection via the Nodes "+" picker. */
  async addWidget(widget: 'Container' | 'Image' | 'Label' | 'Button' | 'Input' | 'Dropdown') {
    const before = (await this.nodeLabels()).length;
    await page.locator(`${RAIL} [aria-label="Add widget"]`).click();
    await this.pickerRow(widget).click();
    await page.waitForFunction(
      ([selector, count]) =>
        document.querySelectorAll(selector as string).length > (count as number),
      [`${TREE} .Tree[data-test-label]`, before] as const,
      { timeout: 10_000 },
    );
  }

  async selectNode(label: string) {
    await page.locator(`${this.nodeRowSelector(label)} .selectable-area`).click();
  }

  async toggleHidden(label: string) {
    const row = this.nodeRowSelector(label);
    await page.locator(row).hover();
    await page.locator(`${row} [aria-label="Hide node"], ${row} [aria-label="Show node"]`).click();
  }

  async isNodeHidden(label: string) {
    return (
      (await page.locator(`${this.nodeRowSelector(label)} .action-area.is-hidden`).count()) > 0
    );
  }

  /** The row context menu's entries, e.g. to assert Rename is not offered. */
  async contextMenuItems(label: string) {
    await page
      .locator(`${this.nodeRowSelector(label)} .selectable-area`)
      .click({ button: 'right' });
    await page.locator('role=menuitem').first().waitFor({ state: 'visible', timeout: 5_000 });
    const items = await page.locator('role=menuitem').allTextContents();
    await page.keyboard.press('Escape');
    return items.map(t => t.trim());
  }

  async isMobileHudRowVisible() {
    return (await page.locator(`${RAIL} ${MOBILE_HUD_ROW}`).count()) > 0;
  }

  /** Click a GUI row by name to select it. */
  async selectRoot(name: string) {
    await this.rootRow(name).click();
  }

  async isRootActive(name: string) {
    return (await this.rootRow(name).evaluate(el => el.classList.contains('is-active'))) === true;
  }

  async selectMobileHud() {
    await page.locator(`${RAIL} ${MOBILE_HUD_ROW}`).click();
    await page.locator(MOBILE_HUD_PANEL).waitFor({ state: 'attached', timeout: 10_000 });
  }

  async isMobileHudPanelVisible() {
    return (await page.locator(MOBILE_HUD_PANEL).count()) > 0;
  }

  /** How many GUI rows show as selected (should be 0 while MobileHUD is selected). */
  async activeRootCount() {
    return page.locator(`${RAIL} ${ROOT_ROW}.is-active`).count();
  }

  /** How many bottom-bar palette cards are draggable (0 while MobileHUD is selected). */
  async enabledPaletteCount() {
    return page.locator('.ui-designer-palette-card:not(.disabled)').count();
  }

  async toggleHudGlobal(label: 'Hide Joystick' | 'Hide Crosshair' | 'Hide Input Actions') {
    await page.locator(`${MOBILE_HUD_PANEL} [aria-label="${label}"]`).click();
  }

  async isHudGlobalChecked(label: 'Hide Joystick' | 'Hide Crosshair' | 'Hide Input Actions') {
    return page.locator(`${MOBILE_HUD_PANEL} [aria-label="${label}"]`).isChecked();
  }

  async setMainAction(action: string) {
    await page.locator(`${MOBILE_HUD_PANEL} [aria-label="Set ${action} as Main"]`).click();
  }

  async mainAction() {
    const rows = page.locator(
      `${MOBILE_HUD_PANEL} .ui-designer-mobile-hud-action[data-main="true"]`,
    );
    return (await rows.count()) > 0 ? rows.first().getAttribute('data-action') : null;
  }

  /** Toggle a button's visibility via its eye control. */
  async toggleActionHidden(action: string) {
    await page
      .locator(`${MOBILE_HUD_PANEL} .ui-designer-mobile-hud-action[data-action="${action}"]`)
      .locator(`[aria-label="Hide ${action}"], [aria-label="Show ${action}"]`)
      .click();
  }

  /** The action drawn as the big Main button in the canvas preview (`data-main`). */
  async canvasMainAction() {
    const main = page.locator('.ui-designer-mobile-hud-guide[data-main="true"][data-action]');
    return (await main.count()) > 0 ? main.first().getAttribute('data-action') : null;
  }

  /** The `data-kind`s of the buttons/crosshair currently drawn in the read-only preview. */
  async hudGuideKinds() {
    return page
      .locator(`${HUD_GUIDE}[data-kind]`)
      .evaluateAll(els => els.map(el => el.getAttribute('data-kind') ?? ''));
  }

  async isDeviceToggleDisabled() {
    const desktop = await page.locator('[aria-label="Desktop preview"]').isDisabled();
    const mobile = await page.locator('[aria-label="Mobile preview"]').isDisabled();
    return desktop && mobile;
  }

  async renameNode(label: string, next: string) {
    await page
      .locator(`${this.nodeRowSelector(label)} .selectable-area`)
      .click({ button: 'right' });
    await page.locator('role=menuitem[name="Rename"]').click();
    const input = page.locator(`${TREE} input`).first();
    await input.waitFor({ state: 'visible', timeout: 5_000 });
    await page.waitForFunction(
      () => document.activeElement instanceof HTMLInputElement,
      undefined,
      { timeout: 5_000 },
    );
    await input.press('ControlOrMeta+a');
    await page.keyboard.type(next);
    await page.keyboard.press('Enter');
    await page.locator(this.nodeRowSelector(next)).waitFor({ state: 'attached', timeout: 10_000 });
  }
}

export const UIDesigner = new UIDesignerPageObject();
