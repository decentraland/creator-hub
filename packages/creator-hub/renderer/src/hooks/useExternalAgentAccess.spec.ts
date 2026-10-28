import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dispatch = vi.fn();
vi.mock('#store', () => ({ useDispatch: () => dispatch }));

const { ai } = await import('#preload');
const { useExternalAgentAccess } = await import('./useExternalAgentAccess');

describe('useExternalAgentAccess', () => {
  let push: () => void;

  beforeEach(() => {
    dispatch.mockReset();
    vi.mocked(ai.onExternalAccessChanged).mockImplementation(cb => {
      push = cb;
      return { cleanup: vi.fn() };
    });
  });

  describe('when an outside agent was granted access', () => {
    it('should mirror the setting and show a notice that stays until dismissed', async () => {
      vi.mocked(ai.takeExternalAccessGrant).mockResolvedValue(true);

      renderHook(() => useExternalAgentAccess());

      await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(2));
      expect(dispatch.mock.calls[0][0]).toMatchObject({
        type: 'workspace/setExposeMcpServer',
        payload: true,
      });
      expect(dispatch.mock.calls[1][0]).toMatchObject({
        type: 'snackbar/pushSnackbar',
        payload: { type: 'external-agent-access', duration: 0 },
      });
    });

    it('should check again when main says a grant just happened', async () => {
      vi.mocked(ai.takeExternalAccessGrant).mockResolvedValueOnce(false).mockResolvedValue(true);
      renderHook(() => useExternalAgentAccess());
      await waitFor(() => expect(ai.takeExternalAccessGrant).toHaveBeenCalledTimes(1));

      push();

      await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(2));
    });
  });

  describe('when no agent asked', () => {
    it('should do nothing', async () => {
      vi.mocked(ai.takeExternalAccessGrant).mockResolvedValue(false);

      renderHook(() => useExternalAgentAccess());

      await waitFor(() => expect(ai.takeExternalAccessGrant).toHaveBeenCalled());
      expect(dispatch).not.toHaveBeenCalled();
    });
  });
});
