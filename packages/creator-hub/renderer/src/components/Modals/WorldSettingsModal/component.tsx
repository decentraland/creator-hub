import React, { useCallback, useEffect, useMemo, useState } from 'react';
import cx from 'classnames';
import WorldSettingsIcon from '@mui/icons-material/SpaceDashboard';
import { Box, Button, Typography } from 'decentraland-ui2';
import { useDispatch } from '#store';
import { actions as managementActions, type ParcelsPermission } from '/@/modules/store/management';
import { t } from '/@/modules/store/translation/utils';
import { type WorldScene, type WorldSettings } from '/@/lib/worlds';
import { WorldSettingsTab } from '/shared/types/manage';
import type { Props as TabsModalProps } from '../TabsModal';
import { Loader } from '../../Loader';
import { TabsModal } from '../TabsModal';
import { GeneralTab } from './tabs/GeneralTab';
import { DetailsTab } from './tabs/DetailsTab';
import { LayoutTab } from './tabs/LayoutTab';
import './styles.css';

const WORLD_SETTINGS_TABS: Array<{ label: string; value: WorldSettingsTab; public?: boolean }> = [
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
  isOwner: boolean;
  userParcelsPermissions?: ParcelsPermission;
  isLoading: boolean;
};

const WorldSettingsModal: React.FC<Props> = React.memo(
  ({
    worldName,
    worldSettings,
    worldScenes,
    userParcelsPermissions,
    isOwner,
    isLoading,
    activeTab,
    ...props
  }) => {
    const dispatch = useDispatch();
    const [settingsUpdates, setSettingsUpdates] = useState<Partial<WorldSettings>>({});
    const worldSettingsForm = { ...worldSettings, ...settingsUpdates };
    const hasChanges = useMemo(
      () => Object.values(settingsUpdates).filter($ => $ !== undefined).length > 0,
      [settingsUpdates],
    );

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
        setSettingsUpdates({}); // Clear updates after successful save
      } catch {
        // Error is handled in the action
      }
    }, [settingsUpdates, worldName]);

    useEffect(() => {
      if (!props.open) {
        handleDiscard();
      }
    }, [props.open]);

    return (
      <TabsModal
        {...props}
        activeTab={activeTab}
        tabs={WORLD_SETTINGS_TABS}
        showTabs={isOwner}
        title={t('modal.world_settings.title', { worldName: worldName })}
        className={cx('WorldSettingsModal', { Collaborator: !isOwner })}
        icon={<WorldSettingsIcon />}
      >
        {isLoading && !hasChanges ? (
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
                worldName={worldName}
                worldSettings={worldSettings}
                worldScenes={worldScenes}
                isOwner={isOwner}
                userParcelsPermissions={userParcelsPermissions}
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
                  disabled={isLoading}
                >
                  {t('modal.world_settings.actions.discard')}
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSave}
                  disabled={isLoading}
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
