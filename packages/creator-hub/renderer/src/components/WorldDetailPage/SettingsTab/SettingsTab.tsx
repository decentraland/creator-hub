import { InputAdornment } from 'decentraland-ui2';

import type { WorldSettings } from '/@/lib/worlds';
import { t } from '/@/modules/store/translation/utils';

import { FieldTitle } from '../../LandDetailPage/DetailsTab/DetailsTab.styled';
import { SelectCheckbox } from '../../LandDetailPage/SelectCheckbox';
import { Loader } from '../../Loader';
import { useWorldSettings } from '../useWorldSettings';
import { useWorldSettingsDraft } from '../useWorldSettingsDraft';
import type { WorldPermissions } from '../worldPermissions';
import { AccessSection } from './Access';
import { settingsChanges, settingsValid, toSettingsDraft } from './settings';
import { CheckRow, Note, Root, Row, SectionBlock, SmallInput } from './SettingsTab.styled';
import { SkyboxField } from './SkyboxField';

type Props = { worldName: string; access: WorldPermissions['access'] };

function SettingsForm({ worldName, access, saved }: Props & { saved: WorldSettings }) {
  const [draft, setDraft] = useWorldSettingsDraft({
    worldName,
    saved,
    toDraft: toSettingsDraft,
    changesOf: settingsChanges,
    valid: current => settingsValid(current) && (!!current.x || !saved.spawnCoordinates),
  });
  const edit = (patch: Partial<typeof draft>) => setDraft(current => ({ ...current, ...patch }));

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
      {access === 'manage' && <AccessSection worldName={worldName} />}
    </Root>
  );
}

/** The World's Settings: spawn, skybox and General saved from the shell's SAVE; Access, for the owner, saved as it changes. */
export function SettingsTab({ worldName, access }: Props) {
  const settings = useWorldSettings(worldName);
  if (settings === 'failed') return null;
  if (settings === 'loading') return <Loader size={70} />;
  return (
    <SettingsForm
      worldName={worldName}
      access={access}
      saved={settings}
    />
  );
}
