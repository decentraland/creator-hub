import { type Page } from 'playwright';
import { App } from './pageObjects/App';
import { UIDesigner } from './pageObjects/UIDesigner';

declare const page: Page;
declare const __e2eNavUrl: string;

const ROOT = 'MainUI';

describe('UI Designer empty state', () => {
  beforeAll(async () => {
    await page.goto(`${__e2eNavUrl}&uiEditorEnabled=true&uiEditorSupported=true`, {
      timeout: 90_000,
    });
    await App.waitUntilReady();
    await UIDesigner.open();
  });

  test('greet a scene with no GUIs with the first-run guidance', async () => {
    const empty = page.locator(UIDesigner.emptyStateSelector);
    await empty.waitFor({ state: 'attached', timeout: 10_000 });

    await expect(empty.textContent()).resolves.toContain('Start building your UI');
    await expect(
      page.locator(`${UIDesigner.emptyStateSelector} .ui-designer-empty-state-chip`).count(),
    ).resolves.toBe(2);
  });

  test('show no Nodes section when there is no GUI at all', async () => {
    await expect(UIDesigner.isSectionVisible('GUIs')).resolves.toBe(true);
    await expect(UIDesigner.isSectionVisible('Nodes')).resolves.toBe(false);
  });

  test('leave the empty state from its own call to action', async () => {
    await UIDesigner.createRootFromEmptyState();

    await expect(UIDesigner.rootNames()).resolves.toEqual([ROOT]);
    await expect(UIDesigner.isSectionVisible('Nodes')).resolves.toBe(true);
  });

  test('add the first element from the Nodes + on an empty GUI', async () => {
    await UIDesigner.addWidget('Container');

    await expect(UIDesigner.nodeLabels()).resolves.toEqual(['Container']);
  });
});

describe('UI Designer left panel', () => {
  beforeAll(async () => {
    await App.waitUntilReady();
    await UIDesigner.open();
    await UIDesigner.addWidget('Container');
    await UIDesigner.addWidget('Label');
  });

  test('name new nodes after their widget kind, numbering collisions', async () => {
    await expect(UIDesigner.nodeLabels()).resolves.toEqual(['Container', 'Container1', 'Label']);
  });

  test('show the Nodes section once the GUI has content', async () => {
    await expect(UIDesigner.isSectionVisible('GUIs')).resolves.toBe(true);
    await expect(UIDesigner.isSectionVisible('Nodes')).resolves.toBe(true);
  });

  test("filter both GUIs and Nodes from the one search box, keeping a match's ancestors", async () => {
    await UIDesigner.search('container1');

    await page
      .locator(`${UIDesigner.railSelector} .ui-designer-roots-list`)
      .waitFor({ state: 'detached', timeout: 5_000 });
    await expect(UIDesigner.nodeLabels()).resolves.toEqual(['Container', 'Container1']);

    await UIDesigner.clearSearch();
    await page
      .locator(`${UIDesigner.railSelector} .ui-designer-roots-list`)
      .waitFor({ state: 'attached', timeout: 5_000 });
  });

  test('hide the Nodes section when only a GUI matches', async () => {
    await UIDesigner.search(ROOT.toLowerCase());

    await page.locator(UIDesigner.treeSelector).waitFor({ state: 'detached', timeout: 5_000 });
    await expect(UIDesigner.rootNames()).resolves.toEqual([ROOT]);

    await UIDesigner.clearSearch();
    await page.locator(UIDesigner.treeSelector).waitFor({ state: 'attached', timeout: 5_000 });
  });

  test('hide both sections when nothing matches', async () => {
    await UIDesigner.search('nothingmatchesthis');

    await page.locator(UIDesigner.treeSelector).waitFor({ state: 'detached', timeout: 5_000 });
    await page
      .locator(`${UIDesigner.railSelector} .ui-designer-roots-list`)
      .waitFor({ state: 'detached', timeout: 5_000 });

    await UIDesigner.clearSearch();
    await page.locator(UIDesigner.treeSelector).waitFor({ state: 'attached', timeout: 5_000 });
  });

  test('gray a hidden node and keep its eye visible without hover', async () => {
    await expect(UIDesigner.isNodeHidden('Label')).resolves.toBe(false);

    await UIDesigner.toggleHidden('Label');
    await expect(UIDesigner.isNodeHidden('Label')).resolves.toBe(true);

    await UIDesigner.toggleHidden('Label');
    await expect(UIDesigner.isNodeHidden('Label')).resolves.toBe(false);
  });

  test('offer no rename on the root container, which is 1:1 with the GUI that carries the name', async () => {
    await expect(UIDesigner.contextMenuItems('Container')).resolves.toEqual([
      'Duplicate',
      'Delete',
    ]);
    await expect(UIDesigner.contextMenuItems('Container1')).resolves.toContain('Rename');
  });

  test('rename a node, reading the new label back out of the spliced, formatted, reparsed source', async () => {
    await UIDesigner.renameNode('Label', 'Score');

    await expect(UIDesigner.nodeLabels()).resolves.toEqual(['Container', 'Container1', 'Score']);
  });

  test('number a renamed node against the names already taken', async () => {
    await UIDesigner.renameNode('Score', 'Container');

    await expect(UIDesigner.nodeLabels()).resolves.toEqual([
      'Container',
      'Container1',
      'Container2',
    ]);
  });

  test('return to the empty state when the last GUI is deleted', async () => {
    await UIDesigner.removeRoot(ROOT);

    await page
      .locator(UIDesigner.emptyStateSelector)
      .waitFor({ state: 'attached', timeout: 10_000 });
    await expect(UIDesigner.rootNames()).resolves.toEqual([]);
  });
});
