import React from 'react';
import { renderHook } from '@testing-library/react';
import { useSdk } from './useSdk';

let realUseContext: typeof React.useContext;
let useContextMock: vi.Mock<typeof React.useContext>;
const mockSdk = {};

describe('useSdk', () => {
  beforeEach(() => {
    realUseContext = React.useContext;
    useContextMock = React.useContext = vi.fn().mockReturnValue({ sdk: mockSdk });
  });
  afterEach(() => {
    React.useContext = realUseContext;
    useContextMock.mockReset();
  });

  describe('When using the hook without a callback', () => {
    it('should return the sdk', () => {
      const { result } = renderHook(() => useSdk());
      const sdk = result.current;
      expect(sdk).toBe(mockSdk);
    });
  });

  describe('When using the hook with a callback', () => {
    it('should call the callback passing the sdk', () => {
      const cb = vi.fn();
      renderHook(() => useSdk(cb));
      expect(cb).toHaveBeenCalledWith(mockSdk);
    });
    describe('and the callback returns a function', () => {
      it('should call it when the hook is unmounted', () => {
        const unsubscribe = vi.fn();
        const cb = vi.fn().mockReturnValue(unsubscribe);
        const { unmount } = renderHook(() => useSdk(cb));
        unmount();
        expect(unsubscribe).toHaveBeenCalled();
      });
    });
  });
});
