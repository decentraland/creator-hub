import { useState } from 'react';

import { useDispatch } from '#store';
import { useSnackbar } from '/@/hooks/useSnackbar';
import type { WorldSettings } from '/@/lib/worlds';
import { actions as managementActions } from '/@/modules/store/management';
import { t } from '/@/modules/store/translation/utils';

import { useDraft } from '../DetailShell';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const keysOf = <D extends object>(...drafts: D[]) =>
  [...new Set(drafts.flatMap(draft => Object.keys(draft)))] as (keyof D)[];

const differs = <D extends object>(a: D, b: D) => keysOf(a, b).some(key => !same(a[key], b[key]));

/** `next`, keeping every field of `draft` the user changed since `pristine`. */
function rebase<D extends object>(draft: D, pristine: D, next: D): D {
  const rebased = { ...next };
  for (const key of keysOf(draft, pristine))
    if (!same(draft[key], pristine[key])) rebased[key] = draft[key];
  return rebased;
}

/** A World settings form's draft on the DetailShell's CANCEL/SAVE bar. */
export function useWorldSettingsDraft<D extends object>({
  worldName,
  saved,
  toDraft,
  changesOf,
  valid,
}: {
  worldName: string;
  saved: WorldSettings;
  toDraft: (settings: WorldSettings) => D;
  changesOf: (draft: D, settings: WorldSettings) => Partial<WorldSettings>;
  valid: (draft: D) => boolean;
}) {
  const dispatch = useDispatch();
  const { pushGeneric } = useSnackbar();
  const [base, setBase] = useState(saved);
  const [draft, setDraft] = useState(() => toDraft(saved));
  const [pristine, setPristine] = useState(draft);
  const [saving, setSaving] = useState(false);

  if (saved !== base) {
    const next = toDraft(saved);
    setBase(saved);
    setPristine(next);
    setDraft(rebase(draft, pristine, next));
  }

  useDraft({
    dirty: differs(draft, toDraft(saved)),
    valid: valid(draft) && !saving,
    onCancel: () => setDraft(toDraft(saved)),
    onSave: () => {
      setSaving(true);
      setPristine(draft);
      dispatch(
        managementActions.updateWorldSettings({
          worldName,
          worldSettings: changesOf(draft, saved),
        }),
      )
        .unwrap()
        .then(() => pushGeneric('success', t('world_detail.details.saved')))
        .catch(() => setPristine(toDraft(saved)))
        .finally(() => setSaving(false));
    },
  });

  return [draft, setDraft] as const;
}
