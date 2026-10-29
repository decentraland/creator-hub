import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dispatch = vi.fn();
vi.mock('#store', () => ({ useDispatch: () => dispatch }));

const { ai } = await import('#preload');
const { useExternalAgentAccess, EXTERNAL_AGENT_ACCESS_NOTICE_ID } = await import(
  './useExternalAgentAccess'
);

describe('useExternalAgentAccess', () => {
  let push: () => void;

  beforeEach(() => {
    dispatch.mockReset();
    vi.mocked(ai.onExternalAccessRequested).mockImplementation(cb => {
      push = cb;
      return { cleanup: vi.fn() };
    });
  });

  describe('when an outside agent asked for access', () => {
    it('should ask the creator with a notice that stays until answered, and change nothing', async () => {
      vi.mocked(ai.takeExternalAccessRequest).mockResolvedValue(true);

      renderHook(() => useExternalAgentAccess());

      await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
      expect(dispatch.mock.calls[0][0]).toMatchObject({
        type: 'snackbar/pushSnackbar',
        payload: {
          type: 'external-agent-access',
          duration: 0,
          id: EXTERNAL_AGENT_ACCESS_NOTICE_ID,
        },
      });
    });

    it('should check again when main says a request just came in', async () => {
      vi.mocked(ai.takeExternalAccessRequest).mockResolvedValueOnce(false).mockResolvedValue(true);
      renderHook(() => useExternalAgentAccess());
      await waitFor(() => expect(ai.takeExternalAccessRequest).toHaveBeenCalledTimes(1));

      push();

      await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    });
  });

  describe('when no agent asked', () => {
    it('should do nothing', async () => {
      vi.mocked(ai.takeExternalAccessRequest).mockResolvedValue(false);

      renderHook(() => useExternalAgentAccess());

      await waitFor(() => expect(ai.takeExternalAccessRequest).toHaveBeenCalled());
      expect(dispatch).not.toHaveBeenCalled();
    });
  });
});
