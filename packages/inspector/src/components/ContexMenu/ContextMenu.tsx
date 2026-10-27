import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Menu } from 'react-contexify';
import { contextMenu } from 'react-contexify';

export type Props = React.PropsWithChildren<{
  id: string;
  label: string;
}>;

function exposeToAssistiveTech(menu: Element) {
  menu
    .querySelectorAll('.contexify_separator')
    .forEach(separator => separator.setAttribute('role', 'separator'));
  menu.querySelectorAll('svg').forEach(glyph => glyph.setAttribute('aria-hidden', 'true'));
  menu.querySelectorAll('.contexify_submenu').forEach(submenu => {
    submenu.setAttribute('role', 'menu');
    const itemLabel = submenu.parentElement?.getAttribute('aria-label');
    if (itemLabel) submenu.setAttribute('aria-label', itemLabel);
  });
}

export function ContextMenu({ id, label, children }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<Element | null>(null);

  const trackVisibility = useCallback((isVisible: boolean) => {
    if (isVisible) triggerRef.current = document.activeElement;
    setIsVisible(isVisible);
  }, []);

  const hideOnOutsideMouseDown = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isVisible && !target.classList.value.includes('contexify')) {
        contextMenu.hideAll();
      }
    },
    [isVisible],
  );

  useEffect(() => {
    document.addEventListener('mousedown', hideOnOutsideMouseDown);
    return () => {
      document.removeEventListener('mousedown', hideOnOutsideMouseDown);
    };
  });

  useEffect(() => {
    if (!isVisible) return;
    const menu = document.querySelector(`[data-context-menu-id="${id}"]`);
    if (menu) exposeToAssistiveTech(menu);
    const returnFocusOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', returnFocusOnEscape);
    return () => window.removeEventListener('keydown', returnFocusOnEscape);
  }, [isVisible, id]);

  if (!children) return null;

  return (
    <Menu
      id={id}
      aria-label={label}
      data-context-menu-id={id}
      onVisibilityChange={trackVisibility}
      animation={{ enter: 'fade', exit: false }}
    >
      {children}
    </Menu>
  );
}

export default React.memo(ContextMenu);
