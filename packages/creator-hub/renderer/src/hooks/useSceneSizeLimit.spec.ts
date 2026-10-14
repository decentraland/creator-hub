import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DeploymentUtils from '/@/modules/store/deployment/utils';

import { useSceneSizeLimit } from './useSceneSizeLimit';

const fetchSceneSizeLimitMock = vi.fn();

vi.mock('/@/modules/store/deployment/utils', async importOriginal => ({
  ...(await importOriginal<typeof DeploymentUtils>()),
  fetchSceneSizeLimit: (...args: unknown[]) => fetchSceneSizeLimitMock(...args),
}));

describe('useSceneSizeLimit', () => {
  let result: { current: number | null };

  beforeEach(() => {
    fetchSceneSizeLimitMock.mockReset();
  });

  describe('when there is no deployment yet', () => {
    beforeEach(() => {
      ({ result } = renderHook(() => useSceneSizeLimit(undefined)));
    });

    it('should report no limit without fetching one', () => {
      expect(result.current).toBeNull();
      expect(fetchSceneSizeLimitMock).not.toHaveBeenCalled();
    });
  });

  describe('when there is a deployment', () => {
    beforeEach(async () => {
      fetchSceneSizeLimitMock.mockResolvedValueOnce(1000);
      ({ result } = renderHook(() =>
        useSceneSizeLimit({ isWorld: true, worldName: 'name.dcl.eth', parcels: ['0,0', '0,1'] }),
      ));
      await waitFor(() => expect(result.current).not.toBeNull());
    });

    it("should fetch the limit for the deployment's target", () => {
      expect(fetchSceneSizeLimitMock).toHaveBeenCalledWith({
        isWorld: true,
        worldName: 'name.dcl.eth',
        parcels: ['0,0', '0,1'],
      });
    });

    it('should report the fetched limit', () => {
      expect(result.current).toBe(1000);
    });
  });
});
