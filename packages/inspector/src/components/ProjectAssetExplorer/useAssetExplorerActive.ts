import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

import { useAppDispatch } from '../../redux/hooks';
import { setAssetExplorerActive } from '../../redux/ui';

const MODAL_PORTAL = '.ReactModalPortal';
const MODAL_OPEN_CLASS = 'ReactModal__Body--open';

const isModalOpen = () => document.body.classList.contains(MODAL_OPEN_CLASS);

/** Whether the explorer's keys run (clicked inside, no modal open); the store gets the click alone. */
export function useAssetExplorerActive(containerRef: RefObject<HTMLElement>): boolean {
  const dispatch = useAppDispatch();
  const [clickedInside, setClickedInside] = useState(false);
  const [modalOpen, setModalOpen] = useState(isModalOpen);
  const active = clickedInside && !modalOpen;

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.(MODAL_PORTAL)) return;
      setClickedInside(!!containerRef.current?.contains(target));
    };
    const onWindowBlur = () => setClickedInside(false);
    const modalObserver = new MutationObserver(() => setModalOpen(isModalOpen()));
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('blur', onWindowBlur);
    modalObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', onWindowBlur);
      modalObserver.disconnect();
    };
  }, [containerRef]);

  useEffect(() => {
    dispatch(setAssetExplorerActive({ active: clickedInside }));
  }, [dispatch, clickedInside]);

  useEffect(() => () => void dispatch(setAssetExplorerActive({ active: false })), [dispatch]);

  return active;
}
