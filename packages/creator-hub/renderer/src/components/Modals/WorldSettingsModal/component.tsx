import React, { useCallback, useState } from 'react';
import WorldSettingsIcon from '@mui/icons-material/SpaceDashboard';
import { Box, Button, Typography } from 'decentraland-ui2';
import { useDispatch } from '#store';
import { actions as managementActions } from '/@/modules/store/management';
import { t } from '/@/modules/store/translation/utils';
import type { WorldScene, WorldSettings } from '/@/lib/worlds';
import { WorldSettingsTab } from '/shared/types/manage';
import type { Props as TabsModalProps } from '../TabsModal';
import { Loader } from '../../Loader';
import { TabsModal } from '../TabsModal';
import { GeneralTab } from './tabs/GeneralTab';
import { DetailsTab } from './tabs/DetailsTab';
import { LayoutTab } from './tabs/LayoutTab';
import './styles.css';

const WORLD_SETTINGS_TABS: Array<{ label: string; value: WorldSettingsTab }> = [
  {
    label: t('modal.world_settings.tabs.details.label'),
    value: WorldSettingsTab.DETAILS,
  },
  {
    label: t('modal.world_settings.tabs.layout.label'),
    value: WorldSettingsTab.LAYOUT,
  },
  {
    label: t('modal.world_settings.tabs.general.label'),
    value: WorldSettingsTab.GENERAL,
  },
];

type Props = Omit<TabsModalProps<WorldSettingsTab>, 'tabs' | 'title' | 'children'> & {
  worldName: string;
  worldSettings: WorldSettings;
  worldScenes: WorldScene[];
  isLoading: boolean;
};

const WorldSettingsModal: React.FC<Props> = React.memo(
  ({ worldName, worldSettings, worldScenes, isLoading, activeTab, ...props }) => {
    const dispatch = useDispatch();
    const [settingsUpdates, setSettingsUpdates] = useState<Partial<WorldSettings>>({});
    const worldSettingsForm = { ...worldSettings, ...settingsUpdates };
    const hasChanges = Object.keys(settingsUpdates).length > 0;

    const handleUpdateSettings = useCallback((newSettings: Partial<WorldSettings>) => {
      setSettingsUpdates(prev => ({ ...prev, ...newSettings }));
    }, []);

    const handleDiscard = useCallback(() => {
      setSettingsUpdates({});
    }, []);

    const handleSave = useCallback(async () => {
      try {
        await dispatch(
          managementActions.updateWorldSettings({ worldName, worldSettings: settingsUpdates }),
        ).unwrap();
        setSettingsUpdates({});
      } catch {
        // Error is handled in the action
      }
    }, [settingsUpdates, worldName]);

    return (
      <TabsModal
        {...props}
        activeTab={activeTab}
        tabs={WORLD_SETTINGS_TABS}
        title={t('modal.world_settings.title', { worldName: worldName })}
        className="WorldSettingsModal"
        icon={<WorldSettingsIcon />}
      >
        {isLoading ? (
          <Loader size={40} />
        ) : (
          <>
            {activeTab === WorldSettingsTab.GENERAL && (
              <GeneralTab
                worldSettings={worldSettingsForm}
                onChangeSettings={handleUpdateSettings}
              />
            )}
            {activeTab === WorldSettingsTab.DETAILS && (
              <DetailsTab
                worldSettings={worldSettingsForm}
                onChangeSettings={handleUpdateSettings}
              />
            )}
            {activeTab === WorldSettingsTab.LAYOUT && (
              <LayoutTab
                worldSettings={worldSettings}
                worldScenes={worldScenes}
              />
            )}
            {activeTab !== WorldSettingsTab.LAYOUT && hasChanges && (
              <Box className="ActionsContainer">
                <Typography className="UnsavedChangesText">
                  {t('modal.world_settings.discard_confirmation')}
                </Typography>
                <Button
                  variant="text"
                  color="secondary"
                  onClick={handleDiscard}
                >
                  {t('modal.world_settings.actions.discard')}
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSave}
                >
                  {isLoading ? (
                    <Loader
                      size={16}
                      color="secondary"
                    />
                  ) : (
                    t('modal.world_settings.actions.save')
                  )}
                </Button>
              </Box>
            )}
          </>
        )}
      </TabsModal>
    );
  },
);

export { WorldSettingsModal };
