import { type Page } from 'playwright';

declare const page: Page;

/**
 * DOM-only readers for the EntityInspector's component panels. They observe
 * the rendered field values so the test asserts on what a user sees — no
 * `window.sdk` exposure required.
 *
 * The component panels' wrapping `className`s (e.g. `.GltfInspector`,
 * `.PlaySoundActionContainer`) are stable; rather than pin to the Dropdown's
 * inner option-label DOM (which only renders when the value matches a known
 * option in the catalog), we read all visible text within the panel and look
 * for the substituted file extension. That covers the bug surface — with the
 * regression the inner `jsonPayload.src` collapses to the bare base directory
 * (no `.mp3`); with the fix it surfaces the resource filename — without
 * coupling the test to Dropdown internals.
 */
class InspectorPageObject {
  async waitForEntityInspector(timeout = 10_000) {
    await page.waitForSelector('.EntityInspector', { timeout });
  }

  async waitForPanel(selector: string, timeout = 20_000) {
    await page.waitForSelector(selector, { timeout });
  }

  async getPanelText(selector: string): Promise<string> {
    const text = await page.locator(selector).first().textContent();
    return (text ?? '').toLowerCase();
  }
}

export const Inspector = new InspectorPageObject();
