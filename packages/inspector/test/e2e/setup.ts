import { beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';

let browser: Browser;
let page: Page;
let isSetup = false;

beforeAll(async () => {
  if (isSetup) {
    return;
  }

  const serverUrl = process.env.E2E_URL || 'http://127.0.0.1:8000';
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
    slowMo: process.env.CI ? 100 : 50, // Increase slowMo for CI
    args: [
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-field-trial-config',
      '--disable-ipc-flooding-protection',
      '--no-sandbox', // Add no-sandbox for CI environments
      '--disable-setuid-sandbox', // Add disable-setuid-sandbox for CI
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

  // Set viewport for consistent performance (larger in CI)
  const viewportSize = process.env.CI
    ? { width: 1920, height: 1080 }
    : { width: 1280, height: 720 };
  await page.setViewportSize(viewportSize);

  (global as any).page = page;
  (global as any).E2E_URL = serverUrl;

  await page.goto(serverUrl);

  try {
    await page.waitForLoadState('domcontentloaded', { timeout: 5000 });
    console.log('Page loaded successfully (domcontentloaded)');
  } catch (error) {
    console.log('Domcontentloaded timeout, continuing...');
  }

  // Wait for app initialization (longer in CI)
  const waitTime = process.env.CI ? 2000 : 500;
  await new Promise(resolve => setTimeout(resolve, waitTime));
  console.log('Setup complete');

  isSetup = true;
}, 120000);

afterAll(async () => {
  await browser?.close();
});
