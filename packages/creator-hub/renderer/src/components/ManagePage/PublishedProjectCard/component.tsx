import React, { useCallback, useMemo } from 'react';
import type { ManagedProject } from '/shared/types/manage';
import { ManagedProjectType, WorldSettingsTab } from '/shared/types/manage';
import WorldSettingsIcon from '@mui/icons-material/SpaceDashboard';
import PublishedIcon from '@mui/icons-material/Cloud';
import ParcelsIcon from '@mui/icons-material/Layers';
import PermissionsIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import { Chip, Typography } from 'decentraland-ui2';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { t } from '/@/modules/store/translation/utils';
import { WorldRoleType } from '/@/lib/worlds';
import { RoleType as LandRoleType } from '/@/lib/land';
import { misc } from '#preload';
import { ContentCopy, OpenInNew } from '@mui/icons-material';
import { Button } from '../../Button';
import { Dropdown } from '../../Dropdown';
import type { Option } from '../../Dropdown';
import thumbnailFallbackImage from './thumbnail-fallback.png';
import { formatName, getJumpInUrl, getLogo, isENSDomain } from './utils';
import './styles.css';

const BUILDER_URL = 'https://decentraland.org/builder';

const COLLABORATOR_ROLES_LABELS = {
  [LandRoleType.OPERATOR]: t('manage.cards.roles.operator'),
  [LandRoleType.TENANT]: t('manage.cards.roles.tenant'),
  [WorldRoleType.COLLABORATOR]: t('manage.cards.roles.collaborator'),
};

type CollaboratorRole = keyof typeof COLLABORATOR_ROLES_LABELS;

function isCollaboratorRole(role: LandRoleType | WorldRoleType): role is CollaboratorRole {
  return role in COLLABORATOR_ROLES_LABELS;
}

export type Props = {
  project: ManagedProject;
  onOpenSettings: (tab?: WorldSettingsTab) => void;
  onViewScenes: () => void;
};

const PublishedProjectCard: React.FC<Props> = React.memo(
  ({ project, onOpenSettings, onViewScenes }) => {
    const { pushGeneric } = useSnackbar();
    const { id, displayName, type, role, deployment } = project;
    const roleLabel = isCollaboratorRole(role) ? COLLABORATOR_ROLES_LABELS[role] : null;

    const handleJumpIn = useCallback(() => {
      const url = getJumpInUrl(id);
      void misc.openExternal(url);
    }, [id]);

    const handleCopyURL = useCallback(() => {
      const url = getJumpInUrl(id);
      void misc.copyToClipboard(url);
      pushGeneric('success', t('snackbar.generic.url_copied'));
    }, [id, pushGeneric]);

    const handleEditName = useCallback(() => {
      const subdomain = isENSDomain(id) ? id : id.split('.')[0];
      void misc.openExternal(`${BUILDER_URL}/names/${subdomain}`);
    }, [id]);

    const handleViewParcel = useCallback(() => {
      void misc.openExternal(`${BUILDER_URL}/land/${id}`);
    }, [id]);

    const handleManagePermissions = useCallback(() => {
      onOpenSettings(WorldSettingsTab.PERMISSIONS);
    }, [onOpenSettings]);

    const handleUnpublish = useCallback(() => {
      // TODO: implement unpublish functionality in future PR.
    }, []);

    const dropdownOptions = useMemo(() => {
      const options: Array<Option & { active: boolean }> = [
        {
          text: t('manage.cards.menu.jump_in'),
          icon: <OpenInNew />,
          handler: handleJumpIn,
          active: type === ManagedProjectType.LAND || !!deployment,
        },
        {
          text: t('manage.cards.menu.copy_url'),
          icon: <ContentCopy />,
          handler: handleCopyURL,
          divider: true,
          active: type === ManagedProjectType.LAND || !!deployment,
        },
        {
          text: t('manage.cards.menu.parcel'),
          icon: <OpenInNew />,
          handler: handleViewParcel,
          active: type === ManagedProjectType.LAND,
        },
        {
          text: t('manage.cards.menu.edit_name'),
          icon: <OpenInNew />,
          handler: handleEditName,
          active:
            type === ManagedProjectType.WORLD && role === WorldRoleType.OWNER && !isENSDomain(id),
        },
        {
          text: t('manage.cards.menu.permissions'),
          icon: <PermissionsIcon />,
          handler: handleManagePermissions,
          active: type === ManagedProjectType.WORLD && role === WorldRoleType.OWNER,
        },
        {
          text: t('manage.cards.menu.unpublish'),
          handler: handleUnpublish,
          active: type === ManagedProjectType.WORLD && role === WorldRoleType.OWNER && !!deployment,
        },
      ];
      return options.filter(option => option.active) as Option[];
    }, [
      project,
      handleJumpIn,
      handleCopyURL,
      handleEditName,
      handleViewParcel,
      handleManagePermissions,
      handleUnpublish,
    ]);

    return (
      <div className="PublishedProjectCard">
        <div className="CardHeader">
          {getLogo(type, id)}
          <Typography className="HeaderTitle">
            {type === ManagedProjectType.LAND ? displayName : formatName(displayName)}
          </Typography>
          {!!dropdownOptions?.length && (
            <Dropdown
              className="options-dropdown"
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
              <img
                src={deployment.thumbnail || thumbnailFallbackImage}
                alt="Project thumbnail" // TODO: use offline fallback Image component when merged.
              />
              <div className="ChipsContainer">
                <Chip
                  variant="outlined"
                  icon={<PublishedIcon />}
                  label={t('manage.cards.published')}
                />
                {type === 'world' && deployment.scenes.length > 1 && (
                  <Chip
                    variant="outlined"
                    icon={<ParcelsIcon />}
                    label={t('manage.cards.worlds.scenes_count', {
                      count: deployment.scenes.length,
                    })}
                  />
                )}
                {deployment.scenes.length === 1 && (
                  <Chip
                    variant="outlined"
                    icon={<ParcelsIcon />}
                    label={t('manage.cards.land.parcels_count', {
                      count: deployment.scenes[0].parcels.length,
                    })}
                  />
                )}
                {roleLabel && (
                  <Chip
                    variant="outlined"
                    icon={<PersonIcon />}
                    label={roleLabel}
                  />
                )}
              </div>
            </div>
            <div className="CardBody">
              <Typography
                variant="body2"
                className="PublishedScene"
              >
                {type === 'land'
                  ? t('manage.cards.published_scene')
                  : t('manage.cards.worlds.published_world')}
              </Typography>
              <Typography className="ProjectTitle">{deployment.title}</Typography>
              {type === 'world' && role === WorldRoleType.OWNER && (
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<WorldSettingsIcon />}
                  className="WorldSettingsButton"
                  onClick={() => onOpenSettings()}
                >
                  {t('manage.cards.worlds.world_settings')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    );
  },
);

export { PublishedProjectCard };
