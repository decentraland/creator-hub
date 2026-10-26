import { renderHook } from '@testing-library/react';

import { useUINodeHotkeys } from './useUINodeHotkeys';

const remove = vi.fn();
const duplicate = vi.fn();
let explorerActive = false;

vi.mock('../../../redux/hooks', () => ({
  useAppSelector: (selector: { name?: string }) =>
    selector.name === 'isAssetExplorerActive' ? explorerActive : 7,
}));
vi.mock('./useUINodeActions', () => ({ useUINodeActions: () => ({ remove, duplicate }) }));

describe('useUINodeHotkeys', () => {
  const press = (key: string) =>
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  let container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    Object.defineProperty(container, 'offsetParent', { get: () => document.body });
    remove.mockClear();
  });
  afterEach(() => {
    document.body.innerHTML = '';
    explorerActive = false;
  });

  describe('when the Local Assets explorer owns the keyboard', () => {
    it('should leave Delete to the explorer', () => {
      explorerActive = true;
      renderHook(() => useUINodeHotkeys({ current: container }));
      press('Delete');
      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe('when the explorer does not own the keyboard', () => {
    it('should delete the selected UI node', () => {
      renderHook(() => useUINodeHotkeys({ current: container }));
      press('Delete');
      expect(remove).toHaveBeenCalledWith(7);
    });
  });
});
