import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

import { useAppDispatch } from '../../redux/hooks';
import { setAssetExplorerActive } from '../../redux/ui';

/** Whether the last click landed in `containerRef` and the window kept the focus, mirrored to the store. */
export function useAssetExplorerActive(containerRef: RefObject<HTMLElement>): boolean {
  const dispatch = useAppDispatch();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) =>
      setActive(!!containerRef.current?.contains(event.target as Node));
    const onWindowBlur = () => setActive(false);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [containerRef]);

  useEffect(() => {
    dispatch(setAssetExplorerActive({ active }));
  }, [dispatch, active]);

  useEffect(() => () => void dispatch(setAssetExplorerActive({ active: false })), [dispatch]);

  return active;
}
