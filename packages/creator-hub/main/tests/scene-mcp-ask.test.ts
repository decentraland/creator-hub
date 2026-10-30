import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AI_ASK_EXPIRED, AI_ASK_REQUEST } from '/shared/types/ipc';

// The `ask_user` bridge with an editor window that never answers, to drive its timeout.
const windowMock = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../src/modules/window', () => ({
  getWindow: () => ({ isDestroyed: () => false, webContents: { send: windowMock.send } }),
}));
vi.mock('../src/mainWindow', () => ({ MAIN_WINDOW_ID: 'main' }));
vi.mock('../src/modules/explorer-gateway', () => ({
  callExplorerTool: vi.fn(),
  explorerTools: () => [],
  onExplorerToolsChanged: () => () => {},
  gatewayProject: () => null,
  launchPreview: vi.fn(),
  previewStatus: vi.fn(),
  stopExplorerGateway: vi.fn(),
  stopPreview: vi.fn(),
}));

import { requestUserPrompt, resolveUserPrompt } from '../src/modules/scene-mcp';

const question = {
  question: 'Replace the files?',
  options: [],
  multiSelect: false,
  allowOther: true,
};

describe('when the user does not answer an ask_user prompt in time', () => {
  let answer: Promise<string | null>;
  let id: string;

  beforeEach(() => {
    vi.useFakeTimers();
    answer = requestUserPrompt(question);
    id = windowMock.send.mock.calls.find(([channel]) => channel === AI_ASK_REQUEST)?.[1].id;
    vi.advanceTimersByTime(10 * 60_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    windowMock.send.mockReset();
  });

  it('should resolve the tool call as dismissed', async () => {
    await expect(answer).resolves.toBeNull();
  });

  it('should tell the chat panel to close that prompt', () => {
    expect(windowMock.send).toHaveBeenCalledWith(AI_ASK_EXPIRED, { id });
  });

  describe('and the user answers afterwards', () => {
    it('should ignore the answer without throwing', () => {
      expect(() => resolveUserPrompt(id, 'Replace')).not.toThrow();
    });
  });
});

describe('when the user answers an ask_user prompt in time', () => {
  let answer: Promise<string | null>;

  beforeEach(() => {
    vi.useFakeTimers();
    answer = requestUserPrompt(question);
    const id = windowMock.send.mock.calls.find(([channel]) => channel === AI_ASK_REQUEST)?.[1].id;
    resolveUserPrompt(id, 'Replace');
    vi.advanceTimersByTime(10 * 60_000);
  });

  afterEach(() => {
    vi.useRealTimers();
    windowMock.send.mockReset();
  });

  it('should resolve the tool call with the answer and not expire the prompt', async () => {
    await expect(answer).resolves.toBe('Replace');
    expect(windowMock.send.mock.calls.map(([channel]) => channel)).not.toContain(AI_ASK_EXPIRED);
  });
});
