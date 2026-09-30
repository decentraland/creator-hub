import { App } from './pageObjects/App';
import { Hierarchy } from './pageObjects/Hierarchy';
import { Transform } from './pageObjects/Transform';
import { installMouseHelper } from './utils/install-mouse-helper';
import { expect, test } from './fixtures';

const ROOT = 0;

const rotation = (axis: 'X' | 'Y' | 'Z') => async () =>
  parseFloat(await Transform.getRotationValue(axis));

test.describe('Transform', () => {
  test.beforeAll(async () => {
    await installMouseHelper(page);
    await App.waitUntilReady();
  });

  test.afterAll(async () => {
    await Hierarchy.getId('rotation-test')
      .then(id => Hierarchy.remove(id))
      .catch(() => undefined);
    await page.click('body', { position: { x: 0, y: 0 } });
    await page.keyboard.press('Escape');
  });

  test('create and select entity', async () => {
    await Hierarchy.addChild(ROOT, 'rotation-test');
    const entityId = await Hierarchy.getId('rotation-test');
    expect(entityId).toBeGreaterThanOrEqual(512);

    await page.locator(Hierarchy.getItemSelectorById(entityId)).click();
    await Transform.waitUntilVisible();
  });

  test('rotation fields should default to 0', async () => {
    await expect.poll(rotation('X')).toBe(0);
    await expect.poll(rotation('Y')).toBe(0);
    await expect.poll(rotation('Z')).toBe(0);
  });

  test('set rotation X to 90 should preserve value', async () => {
    await Transform.setRotationValue('X', '90');
    await expect.poll(rotation('X')).toBeCloseTo(90, 0);
  });

  test('set rotation Y to 90 should preserve X', async () => {
    await Transform.setRotationValue('Y', '90');
    await expect.poll(rotation('Y')).toBeCloseTo(90, 0);
    await expect.poll(rotation('X')).toBeCloseTo(90, 0);
  });

  test('set rotation Z to 90 should preserve X and Y (gimbal lock)', async () => {
    await Transform.setRotationValue('Z', '90');
    await expect.poll(rotation('Z')).toBeCloseTo(90, 0);
    await expect.poll(rotation('X')).toBeCloseTo(90, 0);
    await expect.poll(rotation('Y')).toBeCloseTo(90, 0);
  });

  test('editing rotation Z should not change X or Y', async () => {
    for (const axis of ['X', 'Y', 'Z'] as const) {
      await Transform.setRotationValue(axis, '0');
      await expect.poll(rotation(axis)).toBe(0);
    }

    await Transform.setRotationValue('X', '45');
    await expect.poll(rotation('X')).toBeCloseTo(45, 0);
    await Transform.setRotationValue('Y', '30');
    await expect.poll(rotation('Y')).toBeCloseTo(30, 0);
    await Transform.setRotationValue('Z', '60');
    await expect.poll(rotation('Z')).toBeCloseTo(60, 0);

    await expect.poll(rotation('X')).toBeCloseTo(45, 0);
    await expect.poll(rotation('Y')).toBeCloseTo(30, 0);
  });
});
