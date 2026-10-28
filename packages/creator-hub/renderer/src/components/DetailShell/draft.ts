import { createContext, useContext, useEffect, useRef } from 'react';

export type Draft = {
  dirty: boolean;
  valid: boolean;
  onCancel: () => void;
  onSave: () => void;
};

export const DraftContext = createContext<(draft: Draft | null) => void>(() => {});

/** Reports a tab's unsaved edits to the `DetailShell`, which shows CANCEL / SAVE and guards leaving. */
export function useDraft({ dirty, valid, onCancel, onSave }: Draft) {
  const report = useContext(DraftContext);
  const handlers = useRef({ onCancel, onSave });
  handlers.current = { onCancel, onSave };

  useEffect(() => {
    report({
      dirty,
      valid,
      onCancel: () => handlers.current.onCancel(),
      onSave: () => handlers.current.onSave(),
    });
  }, [report, dirty, valid]);

  useEffect(() => () => report(null), [report]);
}
