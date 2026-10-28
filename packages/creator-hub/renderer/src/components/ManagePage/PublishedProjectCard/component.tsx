import React, { useMemo } from 'react';
import { type ManagedProject, WorldSettingsTab } from '/shared/types/manage';
import WorldSettingsIcon from '@mui/icons-material/SpaceDashboard';
import ParcelsIcon from '@mui/icons-material/Layers';
import { Chip, Typography } from 'decentraland-ui2';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { t } from '/@/modules/store/translation/utils';
import { WorldRoleType } from '/@/lib/worlds';
import FallbackThumbnail from '/assets/images/scene-thumbnail-fallback.png';
import { Image } from '../../Image';
import { Button } from '../../Button';
import { Dropdown } from '../../Dropdown';
import { getRoleTag, RoleTag } from '../RoleTag';
import { getWorldMenuOptions } from '../ManagedProjectsList/worldMenu';
import { formatName, getLogo } from './utils';
import './styles.css';

export type Props = {
  project: ManagedProject;
  onOpenSettings: (tab: WorldSettingsTab) => void;
  onViewScenes: () => void;
  onUnpublishWorld: () => void;
};

const PublishedProjectCard: React.FC<Props> = React.memo(
  ({ project, onOpenSettings, onViewScenes, onUnpublishWorld }) => {
    const { pushGeneric } = useSnackbar();
    const { id, displayName, type, role, deployment } = project;
    const roleTag = getRoleTag(role);

    const dropdownOptions = useMemo(
      () =>
        getWorldMenuOptions(project, {
          onUnpublishWorld,
          onUrlCopied: () => pushGeneric('success', t('snackbar.generic.url_copied')),
        }),
      [project, onUnpublishWorld, pushGeneric],
    );

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
