import { type Page } from 'playwright';

declare const page: Page;

class TransformPageObject {
  /**
   * Returns a Playwright Locator for a specific rotation axis input.
   * Uses text matching to find the Rotation block, then the axis field.
   */
  private getRotationInput(axis: 'X' | 'Y' | 'Z') {
    const rotationBlock = page
      .locator('.Container.Transform .Block')
      .filter({ has: page.locator('.content > .Label', { hasText: /^Rotation$/ }) });
    return rotationBlock
      .locator('.Text.Field')
      .filter({
        has: page.locator('.LeftContent .InputLabel', { hasText: new RegExp(`^${axis}$`) }),
      })
      .locator('input');
  }

  /**
   * Gets the current value of a rotation axis input.
   */
  async getRotationValue(axis: 'X' | 'Y' | 'Z'): Promise<string> {
    return this.getRotationInput(axis).inputValue();
  }

  /**
   * Sets a rotation axis value by clicking the input, selecting all, typing the value, then pressing Tab to blur.
   */
  async setRotationValue(axis: 'X' | 'Y' | 'Z', value: string) {
    const input = this.getRotationInput(axis);
    await input.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(value);
    await page.keyboard.press('Tab');
  }

  /**
   * Waits for the Transform Inspector panel to be visible.
   */
  async waitUntilVisible() {
    await page.waitForSelector('.Container.Transform', { timeout: 10_000 });
  }
}

export const Transform = new TransformPageObject();
