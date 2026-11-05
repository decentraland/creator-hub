import { useCallback, useSyncExternalStore } from 'react';

/** Whether the CSS media `query` matches the window, updated as it changes. */
export function useMatchMedia(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
