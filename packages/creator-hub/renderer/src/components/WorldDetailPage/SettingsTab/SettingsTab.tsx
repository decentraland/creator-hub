import { useState } from 'react';
import { InputAdornment } from 'decentraland-ui2';

import { useDispatch } from '#store';
import { useSnackbar } from '/@/hooks/useSnackbar';
import type { WorldSettings } from '/@/lib/worlds';
import { actions as managementActions } from '/@/modules/store/management';
import { t } from '/@/modules/store/translation/utils';

import { useDraft } from '../../DetailShell';
import { FieldTitle } from '../../LandDetailPage/DetailsTab/DetailsTab.styled';
import { SelectCheckbox } from '../../LandDetailPage/SelectCheckbox';
import { Loader } from '../../Loader';
import { useWorldSettings } from '../useWorldSettings';
import { AccessSection } from './Access';
import { settingsChanges, settingsValid, toSettingsDraft } from './settings';
import { CheckRow, Note, Root, Row, SectionBlock, SmallInput } from './SettingsTab.styled';
import { SkyboxField } from './SkyboxField';

function SettingsForm({ worldName, saved }: { worldName: string; saved: WorldSettings }) {
  const dispatch = useDispatch();
  const { pushGeneric } = useSnackbar();
  const [base, setBase] = useState(saved);
  const [draft, setDraft] = useState(() => toSettingsDraft(saved));
  const [saving, setSaving] = useState(false);

  if (saved !== base) {
    setBase(saved);
    setDraft(toSettingsDraft(saved));
  }

  const changes = settingsChanges(draft, saved);
  const edit = (patch: Partial<typeof draft>) => setDraft(current => ({ ...current, ...patch }));

  const initial = toSettingsDraft(saved);
  useDraft({
    dirty: Object.keys(changes).length > 0 || draft.x !== initial.x || draft.y !== initial.y,
    valid: settingsValid(draft) && !saving,
    onCancel: () => setDraft(toSettingsDraft(saved)),
    onSave: () => {
      setSaving(true);
      dispatch(managementActions.updateWorldSettings({ worldName, worldSettings: changes }))
        .unwrap()
        .then(() => pushGeneric('success', t('world_detail.details.saved')))
        .catch(() => undefined)
        .finally(() => setSaving(false));
    },
  });

  const coordinate = (axis: 'x' | 'y') => (
    <SmallInput
      value={draft[axis]}
      startAdornment={
        <InputAdornment
          position="start"
          className="Prefix"
        >
          {axis.toUpperCase()}
        </InputAdornment>
      }
      inputProps={{ 'aria-label': axis.toUpperCase(), inputMode: 'numeric' }}
      onChange={event => edit({ [axis]: event.target.value.trim() })}
    />
  );

  return (
    <Root>
      <SectionBlock>
        <FieldTitle as="span">{t('world_detail.settings.spawn')}</FieldTitle>
        <Row className="Tight">
          {coordinate('x')}
          {coordinate('y')}
        </Row>
      </SectionBlock>
      <SkyboxField
        value={draft.skyboxTime}
        onChange={skyboxTime => edit({ skyboxTime })}
      />
      <SectionBlock>
        <FieldTitle as="span">{t('world_detail.settings.general')}</FieldTitle>
        <CheckRow>
          <SelectCheckbox
            checked={draft.singlePlayer}
            onChange={event => edit({ singlePlayer: event.target.checked })}
          />
          {t('world_detail.settings.single_player')}
        </CheckRow>
        <Note>{t('world_detail.settings.single_player_streaming_note')}</Note>
        <CheckRow>
          <SelectCheckbox
            checked={draft.showInPlaces}
            onChange={event => edit({ showInPlaces: event.target.checked })}
          />
          {t('world_detail.settings.discoverable')}
        </CheckRow>
      </SectionBlock>
      <AccessSection worldName={worldName} />
    </Root>
  );
}

/** The World's Settings: spawn, skybox and General saved from the shell's SAVE; Access saved as it changes. */
export function SettingsTab({ worldName }: { worldName: string }) {
  const settings = useWorldSettings(worldName);
  if (settings === 'failed') return null;
  if (settings === 'loading') return <Loader size={70} />;
  return (
    <SettingsForm
      worldName={worldName}
      saved={settings}
    />
  );
}
