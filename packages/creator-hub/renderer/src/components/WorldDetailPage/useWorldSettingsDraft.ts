import { useState } from 'react';

import { useDispatch } from '#store';
import { useSnackbar } from '/@/hooks/useSnackbar';
import type { WorldSettings } from '/@/lib/worlds';
import { actions as managementActions } from '/@/modules/store/management';
import { t } from '/@/modules/store/translation/utils';

import { useDraft } from '../DetailShell';

export function useWorldSettingsDraft<D>({
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
  const [saving, setSaving] = useState(false);

  if (saved !== base) {
    setBase(saved);
    if (Object.keys(changesOf(draft, base)).length === 0) setDraft(toDraft(saved));
  }

  const changes = changesOf(draft, saved);
  useDraft({
    dirty: Object.keys(changes).length > 0,
    valid: valid(draft) && !saving,
    onCancel: () => setDraft(toDraft(saved)),
    onSave: () => {
      setSaving(true);
      dispatch(managementActions.updateWorldSettings({ worldName, worldSettings: changes }))
        .unwrap()
        .then(() => pushGeneric('success', t('world_detail.details.saved')))
        .catch(() => undefined)
        .finally(() => setSaving(false));
    },
  });

  return [draft, setDraft] as const;
}
