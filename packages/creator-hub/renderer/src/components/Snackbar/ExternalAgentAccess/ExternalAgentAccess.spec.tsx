import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import en from '/@/modules/store/translation/locales/en.json';
import es from '/@/modules/store/translation/locales/es.json';
import zh from '/@/modules/store/translation/locales/zh.json';
import { ExternalAgentAccess } from '.';

// Read from disk: vitest stubs stylesheet imports (even `?raw`) to empty strings.
const snackbarCss = readFileSync(join(__dirname, '../styles.css'), 'utf8');

function lookup(locale: object, id: string): unknown {
  return id.split('.').reduce<any>((node, key) => node?.[key], locale);
}

vi.mock('/@/modules/store/translation/utils', () => ({
  t: (id: string) => lookup(en, id) ?? id,
}));

const updateAppSettings = vi.fn();

vi.mock('/@/hooks/useSettings', () => ({
  useSettings: () => ({ settings: { exposeMcpServer: false }, updateAppSettings }),
}));

function renderNotice(onClose = vi.fn()) {
  render(
    <ThemeProvider theme={dark}>
      <div className="Snackbar">
        <ExternalAgentAccess onClose={onClose} />
      </div>
    </ThemeProvider>,
  );
  return onClose;
}

describe('ExternalAgentAccess', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each([
    ['en', en],
    ['es', es],
    ['zh', zh],
  ])('should have a label for every answer in %s', (_name, locale) => {
    for (const key of ['title', 'actions.allow', 'actions.deny']) {
      expect(lookup(locale, `snackbar.external_agent_access.${key}`)).toEqual(expect.any(String));
    }
  });

  it('should show both answers with their labels', () => {
    renderNotice();

    expect(screen.getByRole('button', { name: 'Allow' })).toBeTruthy();
    expect(screen.getByRole('button', { name: "Don't allow" })).toBeTruthy();
  });

  // The snackbar sheet paints button text --dcl red at higher specificity than MUI's own
  // classes; on the contained Allow button that red is also the fill, which left it looking
  // empty (#1718 QA). Selector matching, not computed style: happy-dom ignores specificity.
  it('should keep the red text rule off the contained Allow button', () => {
    renderNotice();
    const redTextSelectors = [...snackbarCss.matchAll(/([^{}]+)\{[^}]*color:\s*var\(--dcl\)/g)].map(
      ([, selector]) => selector.replace(/\/\*[\s\S]*?\*\//g, '').trim(),
    );

    const allow = screen.getByRole('button', { name: 'Allow' });
    const deny = screen.getByRole('button', { name: "Don't allow" });
    expect(redTextSelectors.length).toBeGreaterThan(0);
    expect(redTextSelectors.some(selector => deny.matches(selector))).toBe(true);
    expect(redTextSelectors.some(selector => allow.matches(selector))).toBe(false);
  });

  it('should turn outside access on and close when Allow is clicked', () => {
    const onClose = renderNotice();

    fireEvent.click(screen.getByRole('button', { name: 'Allow' }));

    expect(updateAppSettings).toHaveBeenCalledWith({ exposeMcpServer: true });
    expect(onClose).toHaveBeenCalled();
  });

  it("should close without changing settings when Don't allow is clicked", () => {
    const onClose = renderNotice();

    fireEvent.click(screen.getByRole('button', { name: "Don't allow" }));

    expect(updateAppSettings).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
