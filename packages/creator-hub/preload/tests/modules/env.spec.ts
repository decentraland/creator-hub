import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendSync = vi.fn();
vi.mock('electron', () => ({ ipcRenderer: { sendSync } }));

const { getApiUrlOverrides } = await import('../../src/modules/env');

describe('getApiUrlOverrides', () => {
  beforeEach(() => {
    sendSync.mockReset();
  });

  describe('when main answers with overrides', () => {
    it("should return main's overrides", () => {
      sendSync.mockReturnValue({ CREATOR_FUND_API_URL: 'http://127.0.0.1:50123' });

      expect(getApiUrlOverrides()).toEqual({ CREATOR_FUND_API_URL: 'http://127.0.0.1:50123' });
      expect(sendSync).toHaveBeenCalledWith('creatorFund.getApiUrlOverrides');
    });
  });

  describe('when main fails to answer', () => {
    it('should override nothing', () => {
      sendSync.mockReturnValue(null);

      expect(getApiUrlOverrides()).toEqual({});
    });
  });
});
