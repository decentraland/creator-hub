import React, { useCallback, useMemo } from 'react';
import { type ManagedProject, WorldSettingsTab } from '/shared/types/manage';
import WorldSettingsIcon from '@mui/icons-material/SpaceDashboard';
import ParcelsIcon from '@mui/icons-material/Layers';
import PermissionsIcon from '@mui/icons-material/Lock';
import { Chip, Typography } from 'decentraland-ui2';
import { ContentCopy, OpenInNew } from '@mui/icons-material';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { t } from '/@/modules/store/translation/utils';
import { WorldRoleType } from '/@/lib/worlds';
import FallbackThumbnail from '/assets/images/scene-thumbnail-fallback.png';
import { analytics, misc } from '#preload';
import { getJumpInUrl } from '/@/modules/utils';
import { Image } from '../../Image';
import { Button } from '../../Button';
import { Dropdown } from '../../Dropdown';
import type { Option } from '../../Dropdown';
import { getRoleTag, RoleTag } from '../RoleTag';
import { formatName, getLogo, getStorageUrl, isENSDomain } from './utils';
import './styles.css';

const BUILDER_URL = 'https://decentraland.org/builder';

export type Props = {
  project: ManagedProject;
  onOpenSettings: (tab: WorldSettingsTab) => void;
  onOpenPermissions: () => void;
  onViewScenes: () => void;
  onUnpublishWorld: () => void;
};

const PublishedProjectCard: React.FC<Props> = React.memo(
  ({ project, onOpenSettings, onOpenPermissions, onViewScenes, onUnpublishWorld }) => {
    const { pushGeneric } = useSnackbar();
    const { id, displayName, type, role, deployment } = project;
    const roleTag = getRoleTag(role);

    const handleJumpIn = useCallback(() => {
      const url = getJumpInUrl(id);
      analytics.track('Manage Worlds External Action', { action: 'Jump into World' });
      void misc.openExternal(url);
    }, [id]);

    const handleCopyURL = useCallback(() => {
      const url = getJumpInUrl(id);
      void misc.copyToClipboard(url);
      pushGeneric('success', t('snackbar.generic.url_copied'));
    }, [id, pushGeneric]);

    const handleEditName = useCallback(() => {
      const subdomain = isENSDomain(id) ? id : id.split('.')[0];
      analytics.track('Manage Worlds External Action', { action: 'Edit Name in Web Builder' });
      void misc.openExternal(`${BUILDER_URL}/names/${subdomain}`);
    }, [id]);

    const handleViewStorage = useCallback(() => {
      analytics.track('Manage Worlds External Action', { action: 'View Storage' });
      void misc.openExternal(getStorageUrl(type, id));
    }, [id, type]);

    const dropdownOptions = useMemo(() => {
      const options: Array<Option & { active: boolean }> = [
        {
          text: t('manage.cards.menu.jump_in'),
          icon: <OpenInNew />,
          handler: handleJumpIn,
          active: !!deployment,
        },
        {
          text: t('manage.cards.menu.copy_url'),
          icon: <ContentCopy />,
          handler: handleCopyURL,
          divider: role === WorldRoleType.OWNER,
          active: !!deployment,
        },
        {
          text: t('manage.cards.menu.edit_name'),
          icon: <OpenInNew />,
          handler: handleEditName,
          active: role === WorldRoleType.OWNER && !isENSDomain(id),
        },
        {
          text: t('manage.cards.menu.permissions'),
          icon: <PermissionsIcon />,
          handler: onOpenPermissions,
          active: role === WorldRoleType.OWNER,
        },
        {
          text: t('manage.cards.menu.view_storage'),
          icon: <OpenInNew />,
          handler: handleViewStorage,
          active: !!deployment,
        },
        {
          text: t('manage.cards.menu.unpublish'),
          handler: onUnpublishWorld,
          active: role === WorldRoleType.OWNER && !!deployment?.scenesCount,
        },
      ];
      return options.filter(option => option.active) as Option[];
    }, [
      project,
      handleJumpIn,
      handleCopyURL,
      handleEditName,
      handleViewStorage,
      onOpenPermissions,
    ]);

    return (
      <div className="PublishedProjectCard">
        <div className="CardHeader">
          {getLogo(type, id)}
          <Typography className="HeaderTitle">{formatName(displayName)}</Typography>
          {roleTag && <RoleTag variant={roleTag} />}
          {!!dropdownOptions?.length && (
            <Dropdown
              label={t('menu.options_for', { name: displayName })}
              options={dropdownOptions}
            />
          )}
        </div>
        {!deployment ? (
          <div className="EmptyScene">
            <Typography>{t('manage.cards.no_scene.title')}</Typography>
            <Button
              variant="contained"
              color="secondary"
              onClick={onViewScenes}
            >
              {t('manage.cards.no_scene.view_scenes')}
            </Button>
          </div>
        ) : (
          <>
            <div className="CardThumbnail">
              <Image
                src={deployment.thumbnail}
                alt="Project thumbnail"
                fallbackSrc={FallbackThumbnail}
              />
              <div className="ChipsContainer">
                {deployment.scenesCount > 0 && (
                  <Chip
                    variant="outlined"
                    icon={<ParcelsIcon />}
                    label={t('manage.cards.scenes_count', { count: deployment.scenesCount })}
                  />
                )}
              </div>
            </div>
            <div className="CardBody">
              <Typography
                variant="body2"
                className="PublishedScene"
              >
                {t('manage.cards.worlds.published_world')}
              </Typography>
              <Typography className="ProjectTitle">{deployment.title}</Typography>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<WorldSettingsIcon />}
                className="WorldSettingsButton"
                onClick={() =>
                  onOpenSettings(
                    role === WorldRoleType.OWNER
                      ? WorldSettingsTab.DETAILS
                      : WorldSettingsTab.LAYOUT,
                  )
                }
              >
                {role === WorldRoleType.OWNER
                  ? t('manage.cards.worlds.world_settings')
                  : t('manage.cards.worlds.layout')}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  },
);

export { PublishedProjectCard };
