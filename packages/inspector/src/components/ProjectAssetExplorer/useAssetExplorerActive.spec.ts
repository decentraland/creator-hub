import { renderHook, act } from '@testing-library/react';

import { setAssetExplorerActive } from '../../redux/ui';
import { useAssetExplorerActive } from './useAssetExplorerActive';

const { dispatch } = vi.hoisted(() => ({ dispatch: vi.fn() }));
vi.mock('../../redux/hooks', () => ({ useAppDispatch: () => dispatch }));

describe('useAssetExplorerActive', () => {
  const pointerDown = (target: Element) =>
    act(() => {
      target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });

  let container: HTMLDivElement;
  let outside: HTMLDivElement;
  let modal: HTMLButtonElement;

  beforeEach(() => {
    container = document.createElement('div');
    outside = document.createElement('div');
    const portal = document.createElement('div');
    portal.className = 'ReactModalPortal';
    modal = document.createElement('button');
    portal.appendChild(modal);
    document.body.append(container, outside, portal);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
  });

  describe('when the last click landed inside the explorer', () => {
    it('should be active', () => {
      const { result } = renderHook(() => useAssetExplorerActive({ current: container }));
      pointerDown(container);
      expect(result.current).toBe(true);
    });

    it('should stay active after a click inside a modal', () => {
      const { result } = renderHook(() => useAssetExplorerActive({ current: container }));
      pointerDown(container);
      pointerDown(modal);
      expect(result.current).toBe(true);
    });
  });

  describe('when a modal is open', () => {
    it('should not be active until the modal closes', async () => {
      const { result } = renderHook(() => useAssetExplorerActive({ current: container }));
      pointerDown(container);
      await act(async () => {
        document.body.classList.add('ReactModal__Body--open');
      });
      expect(result.current).toBe(false);
      expect(dispatch).toHaveBeenLastCalledWith(setAssetExplorerActive({ active: true }));
      await act(async () => {
        document.body.classList.remove('ReactModal__Body--open');
      });
      expect(result.current).toBe(true);
    });
  });

  describe('when the last click landed elsewhere', () => {
    it('should not be active', () => {
      const { result } = renderHook(() => useAssetExplorerActive({ current: container }));
      pointerDown(container);
      pointerDown(outside);
      expect(result.current).toBe(false);
    });
  });
});
