import React, { useMemo } from 'react';
import { ManagedProjectType, WorldSettingsTab } from '/shared/types/manage';
import WorldSettingsIcon from '@mui/icons-material/SpaceDashboard';
import PublishedIcon from '@mui/icons-material/Cloud';
import ParcelsIcon from '@mui/icons-material/Layers';
import PermissionsIcon from '@mui/icons-material/Lock';
import { Chip, Typography } from 'decentraland-ui2';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { t } from '/@/modules/store/translation/utils';
import { misc } from '#preload';
import { ContentCopy, OpenInNew } from '@mui/icons-material';
import { Button } from '../../Button';
import { Dropdown } from '../../Dropdown';
import type { Option } from '../../Dropdown';
import thumbnailFallbackImage from './thumbnail-fallback.png';
import { formatName, getJumpInUrl, getLogo, isENSDomain } from './utils';
import './styles.css';

const BUILDER_URL = 'https://decentraland.org/builder';

export type Props = {
  type: ManagedProjectType;
  name: string;
  role?: 'owner' | 'operator';
  publishMetadata?: {
    title: string;
    thumbnail?: string;
    totalParcels?: number;
    totalScenes: number;
  };
  onOpenSettings: (tab?: WorldSettingsTab) => void;
  onViewScenes: () => void;
};

const PublishedProjectCard: React.FC<Props> = React.memo(
  ({ name, type, role, publishMetadata, onOpenSettings, onViewScenes }) => {
    const { pushGeneric } = useSnackbar();

    const handleJumpIn = () => {
      const url = getJumpInUrl(name);
      misc.openExternal(url);
    };

    const handleCopyURL = () => {
      const url = getJumpInUrl(name);
      misc.copyToClipboard(url);
      pushGeneric('success', t('snackbar.generic.url_copied'));
    };

    const handleEditName = () => {
      const subdomain = isENSDomain(name) ? name : name.split('.')[0];
      misc.openExternal(`${BUILDER_URL}/names/${subdomain}`); /// TODO: test ENS here
    };

    const handleViewParcel = () => {
      misc.openExternal(`${BUILDER_URL}/land/${name}`);
    };

    const handleManagePermissions = () => {
      onOpenSettings(WorldSettingsTab.PERMISSIONS);
    };

    const handleUnpublish = () => {
      /// TODO: implement unpublish flow
    };

    const dropdownOptions = useMemo(() => {
      const options: Array<Option & { active: boolean }> = [
        {
          text: t('manage.cards.menu.jump_in'),
          icon: <OpenInNew />,
          handler: handleJumpIn,
          active: !!publishMetadata,
        },
        {
          text: t('manage.cards.menu.copy_url'),
          icon: <ContentCopy />,
          handler: handleCopyURL,
          divider: true,
          active: !!publishMetadata,
        },
        {
          text: t('manage.cards.menu.edit_name'),
          icon: <OpenInNew />,
          handler: handleEditName,
          active: type === ManagedProjectType.WORLD && !isENSDomain(name),
        },
        {
          text: t('manage.cards.menu.parcel'),
          icon: <OpenInNew />,
          handler: handleViewParcel,
          active: type === ManagedProjectType.LAND,
        },
        {
          text: t('manage.cards.menu.permissions'),
          icon: <PermissionsIcon />,
          handler: handleManagePermissions,
          active: type === ManagedProjectType.WORLD && role === 'owner',
        },
        {
          text: t('manage.cards.menu.unpublish'),
          handler: handleUnpublish,
          active: !!publishMetadata,
        },
      ];
      return options.filter(option => option.active) as Option[];
    }, [name, type, publishMetadata]);

    return (
      <div className="PublishedProjectCard">
        <div className="CardHeader">
          {getLogo(type, name)}
          <Typography className="HeaderTitle">
            {type === ManagedProjectType.LAND ? name : formatName(name)}
          </Typography>
          {dropdownOptions?.length && (
            <Dropdown
              className="options-dropdown"
              options={dropdownOptions}
            />
          )}
        </div>
        {!publishMetadata ? (
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
                src={publishMetadata.thumbnail || thumbnailFallbackImage}
                alt="Project thumbnail" /// TODO: use offline fallback Image component when merged.
              />
              <div className="ChipsContainer">
                <Chip
                  variant="outlined"
                  icon={<PublishedIcon />}
                  label={t('manage.cards.published')}
                />
                {type === 'world' && publishMetadata.totalScenes > 1 && (
                  <Chip
                    variant="outlined"
                    icon={<ParcelsIcon />}
                    label={t('manage.cards.worlds.scenes_count', {
                      count: publishMetadata.totalScenes,
                    })}
                  />
                )}
                {type === 'land' && !!publishMetadata.totalParcels && (
                  <Chip
                    variant="outlined"
                    icon={<ParcelsIcon />}
                    label={t('manage.cards.land.parcels_count', {
                      count: publishMetadata.totalParcels,
                    })}
                  />
                )}
                {role === 'operator' && (
                  <Chip
                    variant="outlined"
                    label={t('manage.cards.roles.operator')}
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
              <Typography className="ProjectTitle">{publishMetadata.title}</Typography>
              {type === 'world' && (
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
