import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

import { clear, push } from '../../lib/logic/debug-log-store';
import DebugConsole from './DebugConsole';

vi.mock('../../lib/rpc/scene', () => ({ getSceneClient: () => undefined }));

vi.mock('../../redux/hooks', () => ({
  useAppSelector: (selector: (s: unknown) => unknown) =>
    selector({ ui: { debugConsoleEnabled: true, debugConsoleDetached: false } }),
}));

const ESC = String.fromCharCode(27);

describe('DebugConsole', () => {
  let container: HTMLElement;

  beforeEach(() => {
    ({ container } = render(<DebugConsole />));
  });

  afterEach(() => {
    cleanup();
    act(() => clear());
  });

  describe('when a log line contains HTML markup', () => {
    const markup = '<img src=x onerror=alert(1)>';

    beforeEach(() => {
      act(() => push([`scene says ${markup}`, `${ESC}[31m${markup}${ESC}[0m`]));
    });

    it('should render the markup as literal text', () => {
      expect(screen.getByText(`scene says ${markup}`)).toBeTruthy();
      expect(screen.getByText(markup)).toBeTruthy();
    });

    it('should not create any element from it', () => {
      expect(container.querySelector('img')).toBeNull();
    });
  });

  describe('when a log line carries colour codes', () => {
    beforeEach(() => {
      act(() => push([`${ESC}[31mred${ESC}[0m`]));
    });

    it('should render each line as a single block-level span holding the styled text', () => {
      const line = container.querySelector('.DebugConsole-logs > span');
      expect(line?.textContent).toBe('red');
      expect((screen.getByText('red') as HTMLElement).style.color).toBe('#cd3131');
    });
  });
});
