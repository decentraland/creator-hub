import { flatten } from 'flat';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dark, ThemeProvider } from 'decentraland-ui2/dist/theme';

import { en } from '/@/modules/store/translation/locales';
import { setCurrentLocale } from '/@/modules/store/translation/utils';

import { ConsoleWindow } from './component';

const mocks = vi.hoisted(() => ({
  pushLines: undefined as ((data: string | string[]) => void) | undefined,
}));

vi.mock('#preload', () => ({
  consoleWindow: {
    onConsoleMirrorState: () => ({ cleanup: () => {} }),
    closeConsoleWindow: vi.fn(),
  },
  editor: {
    attachSceneDebugger: async (_path: string, onLines: (data: string | string[]) => void) => {
      mocks.pushLines = onLines;
      return { cleanup: () => {} };
    },
  },
}));

vi.mock('#store', () => ({ useDispatch: () => vi.fn() }));

const ESC = String.fromCharCode(27);

describe('ConsoleWindow', () => {
  let container: HTMLElement;

  beforeEach(async () => {
    setCurrentLocale('en', flatten(en));
    // The window reads its scene path from its own URL; happy-dom ignores history.replaceState.
    (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
      'http://localhost:3000/?path=/scene',
    );
    ({ container } = render(
      <ThemeProvider theme={dark}>
        <ConsoleWindow />
      </ThemeProvider>,
    ));
    await vi.waitFor(() => expect(mocks.pushLines).toBeDefined());
  });

  afterEach(() => {
    cleanup();
    mocks.pushLines = undefined;
  });

  describe('when a log line contains HTML markup', () => {
    const markup = '<img src=x onerror=alert(1)>';

    beforeEach(async () => {
      act(() => mocks.pushLines?.([`scene says ${markup}`, `${ESC}[31m${markup}${ESC}[0m`]));
      await screen.findByText(`scene says ${markup}`);
    });

    it('should render the markup as literal text', () => {
      expect(screen.getByText(markup)).toBeTruthy();
    });

    it('should not create any element from it', () => {
      expect(container.querySelector('img')).toBeNull();
    });
  });

  describe('when a log line carries colour codes', () => {
    beforeEach(async () => {
      act(() => mocks.pushLines?.(`${ESC}[31mred${ESC}[0m`));
      await screen.findByText('red');
    });

    it('should style the coloured text', () => {
      expect(screen.getByText('red').style.color).toBe('#cd3131');
    });
  });
});
