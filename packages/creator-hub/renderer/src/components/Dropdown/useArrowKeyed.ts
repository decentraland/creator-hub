import { useState, type KeyboardEvent } from 'react';

/** Tracks whether an arrow key has moved the highlight since the menu opened, so only keyboard use draws the row ring. */
export function useArrowKeyed() {
  const [arrowKeyed, setArrowKeyed] = useState(false);
  return {
    arrowKeyedClass: arrowKeyed ? 'ArrowKeyed' : undefined,
    onKeyDownCapture: (event: KeyboardEvent) => {
      if (event.key.startsWith('Arrow')) setArrowKeyed(true);
    },
    resetArrowKeyed: () => setArrowKeyed(false),
  };
}
