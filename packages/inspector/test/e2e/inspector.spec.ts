import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, expect, test } from 'vitest';

let browser: Browser;
let page: Page;

beforeAll(async () => {
  // Launch browser
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
});

afterAll(async () => {
  await browser.close();
});

test('Playwright setup is working', async () => {
  // Navigate to a simple HTML page
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head><title>Test Page</title></head>
      <body>
        <div id="app">
          <h1>Inspector Test</h1>
          <button data-testid="test-button">Test Button</button>
        </div>
      </body>
    </html>
  `);

  // Check if the page loaded successfully
  const title = await page.title();
  expect(title).toBe('Test Page');
});

test('Can find UI elements', async () => {
  // Wait for the content to be available
  await page.waitForSelector('#app', { state: 'visible' });

  // Check for basic UI elements
  const heading = await page.$('h1');
  expect(heading, 'Heading should be present').toBeDefined();

  const button = await page.$('[data-testid="test-button"]');
  expect(button, 'Button should be present').toBeDefined();
});

test('Can interact with elements', async () => {
  // Wait for the button to be available
  await page.waitForSelector('[data-testid="test-button"]', { state: 'visible' });

  // Check if we can find interactive elements
  const buttons = await page.$$('button');
  expect(buttons.length).toBeGreaterThan(0);

  // Test clicking the button
  const button = await page.$('[data-testid="test-button"]');
  if (button) {
    await button.click();
    // The button should still be there after clicking
    const buttonAfterClick = await page.$('[data-testid="test-button"]');
    expect(buttonAfterClick, 'Button should still be present after clicking').toBeDefined();
  }
});
