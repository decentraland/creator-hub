import { beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';

let browser: Browser;
let page: Page;
let isSetup = false;

beforeAll(async () => {
  if (isSetup) {
    return;
  }

  const serverUrl = process.env.E2E_URL || 'http://localhost:8000';
  console.log(`Checking server at: ${serverUrl}`);

  try {
    const response = await fetch(serverUrl);
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }
    console.log('✅ Server is running and responding');
  } catch (error) {
    console.error('❌ Server is not running or not accessible');
    console.error('Please start the inspector server first');
    console.error(`Expected server URL: ${serverUrl}`);
    throw new Error(`Inspector server is not running at ${serverUrl}`);
  }

  browser = await chromium.launch({
    headless: process.env.CI ? true : false,
    slowMo: 50, // Reduced from 100ms
    args: [
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-field-trial-config',
      '--disable-ipc-flooding-protection',
    ],
  });
  page = await browser.newPage();

  // Optimize page performance
  await page.addInitScript(() => {
    // Disable animations and transitions
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-delay: -0.01ms !important;
        transition-duration: 0.01ms !important;
        transition-delay: -0.01ms !important;
      }
    `;
    document.head.appendChild(style);
  });

  // Set viewport for consistent performance
  await page.setViewportSize({ width: 1280, height: 720 });

  (global as any).page = page;
  (global as any).E2E_URL = serverUrl;

  await page.goto(serverUrl);

  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    console.log('Page loaded successfully (domcontentloaded)');
  } catch (error) {
    console.log('Domcontentloaded timeout, continuing...');
  }

  // Reduced wait time for app initialization
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('Setup complete');

  isSetup = true;
}, 120000);

afterAll(async () => {
  await browser?.close();
});
