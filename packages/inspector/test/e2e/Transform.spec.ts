import { type Page } from 'playwright';
import { App } from './pageObjects/App';
import { Hierarchy } from './pageObjects/Hierarchy';
import { Transform } from './pageObjects/Transform';
import { installMouseHelper } from './utils/install-mouse-helper';
import { sleep } from './utils/sleep';

declare const page: Page;

const ROOT = 0;

describe('Transform', () => {
  beforeAll(async () => {
    await installMouseHelper(page);
    await App.waitUntilReady();
  }, 30_000);

  afterAll(async () => {
    // Clean up entity and deselect to reset scene state for other test suites
    try {
      const entityId = await Hierarchy.getId('rotation-test');
      await Hierarchy.remove(entityId);
    } catch {
      // Entity might not exist if earlier tests failed
    }
    // Click body to deselect and close any menus/inspectors
    await page.click('body', { position: { x: 0, y: 0 } });
    await page.keyboard.press('Escape');
    await sleep(1000);
  }, 30_000);

  test('create and select entity', async () => {
    await Hierarchy.addChild(ROOT, 'rotation-test');
    const entityId = await Hierarchy.getId('rotation-test');
    expect(entityId).toBeGreaterThanOrEqual(512);

    // Click entity to select it and show the Transform Inspector
    const item = await page.$(Hierarchy.getItemSelectorById(entityId));
    await item!.click();
    await Transform.waitUntilVisible();
  }, 30_000);

  test('rotation fields should default to 0', async () => {
    expect(await Transform.getRotationValue('X')).toBe('0.00');
    expect(await Transform.getRotationValue('Y')).toBe('0.00');
    expect(await Transform.getRotationValue('Z')).toBe('0.00');
  }, 30_000);

  test('set rotation X to 90 should preserve value', async () => {
    await Transform.setRotationValue('X', '90');
    await sleep(200);
    const value = await Transform.getRotationValue('X');
    expect(parseFloat(value)).toBeCloseTo(90, 0);
  }, 30_000);

  test('set rotation Y to 90 should preserve X', async () => {
    await Transform.setRotationValue('Y', '90');
    await sleep(200);
    // X should stay at 90, not change due to gimbal lock
    const xValue = await Transform.getRotationValue('X');
    expect(parseFloat(xValue)).toBeCloseTo(90, 0);
    const yValue = await Transform.getRotationValue('Y');
    expect(parseFloat(yValue)).toBeCloseTo(90, 0);
  }, 30_000);

  test('set rotation Z to 90 should preserve X and Y (gimbal lock)', async () => {
    await Transform.setRotationValue('Z', '90');
    await sleep(200);
    // All three should remain at 90 — this is the gimbal lock scenario
    // where previously Y would change to ~351 and Z to ~0
    const xValue = await Transform.getRotationValue('X');
    const yValue = await Transform.getRotationValue('Y');
    const zValue = await Transform.getRotationValue('Z');
    expect(parseFloat(xValue)).toBeCloseTo(90, 0);
    expect(parseFloat(yValue)).toBeCloseTo(90, 0);
    expect(parseFloat(zValue)).toBeCloseTo(90, 0);
  }, 30_000);

  test('editing rotation Z should not change X or Y', async () => {
    // Reset all rotations to 0
    await Transform.setRotationValue('X', '0');
    await sleep(100);
    await Transform.setRotationValue('Y', '0');
    await sleep(100);
    await Transform.setRotationValue('Z', '0');
    await sleep(200);

    // Set X=45, Y=30, then change Z=60 — no gimbal lock expected
    await Transform.setRotationValue('X', '45');
    await sleep(100);
    await Transform.setRotationValue('Y', '30');
    await sleep(100);
    await Transform.setRotationValue('Z', '60');
    await sleep(200);

    const xValue = await Transform.getRotationValue('X');
    const yValue = await Transform.getRotationValue('Y');
    const zValue = await Transform.getRotationValue('Z');
    expect(parseFloat(xValue)).toBeCloseTo(45, 0);
    expect(parseFloat(yValue)).toBeCloseTo(30, 0);
    expect(parseFloat(zValue)).toBeCloseTo(60, 0);
  }, 30_000);
});
