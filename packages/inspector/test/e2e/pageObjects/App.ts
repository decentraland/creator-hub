/**
 * On the flaky CI failure where `.App.is-ready` is present but never becomes
 * visible, dump what the DOM actually looks like (computed visibility + box of
 * `.App`/`#root`, viewport, canvas presence, engine-ready flag) plus any browser
 * console/page errors, and save a screenshot. This turns the opaque
 * "waitForSelector timeout" into evidence of *why* the app didn't paint.
 */
async function dumpReadyDiagnostics() {
  try {
    const diag = await page.evaluate(() => {
      const app = document.querySelector('.App');
      const root = document.querySelector('#root');
      const cs = app ? getComputedStyle(app) : null;
      const rect = app ? app.getBoundingClientRect() : null;
      const rootRect = root ? root.getBoundingClientRect() : null;
      return {
        appExists: !!app,
        appClass: app ? app.className : null,
        display: cs ? cs.display : null,
        visibility: cs ? cs.visibility : null,
        opacity: cs ? cs.opacity : null,
        appBox: rect ? { w: Math.round(rect.width), h: Math.round(rect.height) } : null,
        rootBox: rootRect
          ? { w: Math.round(rootRect.width), h: Math.round(rootRect.height) }
          : null,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        bodyClass: document.body.className,
        canvasCount: document.querySelectorAll('canvas').length,
        engineReady: !!(window as any).store?.getState?.().sdk?.inspectorEngine,
      };
    });
    console.error('[e2e-diag] .App.is-ready not visible — DOM state:', JSON.stringify(diag));
  } catch (error) {
    console.error('[e2e-diag] failed to collect DOM state:', String(error));
  }

  const logs = (global as any).__e2eConsoleLogs as string[] | undefined;
  console.error(
    '[e2e-diag] browser console/pageerrors:\n' +
      (logs && logs.length ? logs.join('\n') : '(none captured)'),
  );

  try {
    await page.screenshot({ path: `test-results/app-not-ready-${Date.now()}.png`, fullPage: true });
    console.error('[e2e-diag] screenshot saved under packages/inspector/test-results/');
  } catch (error) {
    console.error('[e2e-diag] screenshot failed:', String(error));
  }
}

class AppPageObject {
  async isReady() {
    return (await page.$('.App.is-ready')) !== null;
  }

  async waitUntilReady() {
    try {
      // Cold boot (parse an ~19MB bundle, init Babylon, boot the data layer) is
      // the slowest single wait in the suite — give it explicit headroom beyond
      // the page-wide default so slow shared runners can't trip it.
      await page.waitForSelector('.App.is-ready', { timeout: 90_000 });
    } catch (error) {
      await dumpReadyDiagnostics();
      throw error;
    }
  }
}

export const App = new AppPageObject();
