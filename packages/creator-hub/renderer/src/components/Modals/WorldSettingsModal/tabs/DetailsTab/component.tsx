import React, { useCallback } from 'react';
import cx from 'classnames';
import FolderIcon from '@mui/icons-material/Folder';
import type { TextFieldProps } from 'decentraland-ui2';
import { Box, FormLabel, MenuItem, TextField, Typography } from 'decentraland-ui2';
import { SceneAgeRating, SceneCategory, type WorldSettings } from '/@/lib/worlds';
import { t } from '/@/modules/store/translation/utils';
import { Select } from '/@/components/Select';
import { Button } from '/@/components/Button';
import './styles.css';

const AGE_RATING_OPTIONS = [
  {
    value: SceneAgeRating.Teen,
    label: t('modal.world_settings.details.age_rating_options.teen'),
  },
  {
    value: SceneAgeRating.Adult,
    label: t('modal.world_settings.details.age_rating_options.adult'),
  },
  {
    value: SceneAgeRating.Restricted,
    label: t('modal.world_settings.details.age_rating_options.restricted'),
  },
  {
    value: SceneAgeRating.Everyone,
    label: t('modal.world_settings.details.age_rating_options.everyone'),
  },
];

const CATEGORIES_OPTIONS = [
  {
    value: SceneCategory.ART,
    label: t('modal.world_settings.details.categories_options.art'),
  },
  {
    value: SceneCategory.GAME,
    label: t('modal.world_settings.details.categories_options.game'),
  },
  {
    value: SceneCategory.CASINO,
    label: t('modal.world_settings.details.categories_options.casino'),
  },
  {
    value: SceneCategory.SOCIAL,
    label: t('modal.world_settings.details.categories_options.social'),
  },
  {
    value: SceneCategory.MUSIC,
    label: t('modal.world_settings.details.categories_options.music'),
  },
  {
    value: SceneCategory.FASHION,
    label: t('modal.world_settings.details.categories_options.fashion'),
  },
  {
    value: SceneCategory.CRYPTO,
    label: t('modal.world_settings.details.categories_options.crypto'),
  },
  {
    value: SceneCategory.EDUCATION,
    label: t('modal.world_settings.details.categories_options.education'),
  },
  {
    value: SceneCategory.SHOP,
    label: t('modal.world_settings.details.categories_options.shop'),
  },
  {
    value: SceneCategory.BUSINESS,
    label: t('modal.world_settings.details.categories_options.business'),
  },
  {
    value: SceneCategory.SPORTS,
    label: t('modal.world_settings.details.categories_options.sports'),
  },
];

const InputLabel = ({ label, className, children }: TextFieldProps) => {
  return (
    <FormLabel className={cx('InputLabel', className)}>
      <Typography>{label}</Typography>
      {children}
    </FormLabel>
  );
};

type Props = {
  worldSettings: WorldSettings;
  onChangeSettings: (settings: Partial<WorldSettings>) => void;
};

const DetailsTab: React.FC<Props> = React.memo(({ worldSettings, onChangeSettings }) => {
  const handleSelectThumbnail = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = event => {
          onChangeSettings({ thumbnail: event.target?.result as string });
        };
        reader.readAsDataURL(file);
      }
    },
    [onChangeSettings],
  );

  return (
    <Box className="DetailsTab">
      <InputLabel
        label={t('modal.world_settings.details.world_title')}
        className="ColBig"
      >
        <TextField
          value={worldSettings.title || ''}
          onChange={e => onChangeSettings({ title: e.target.value })}
        />
      </InputLabel>
      <InputLabel
        label={t('modal.world_settings.details.description')}
        className="ColBig"
      >
        <TextField
          rows={4}
          multiline
          value={worldSettings.description || ''}
          onChange={e => onChangeSettings({ description: e.target.value })}
        />
      </InputLabel>

      <Box className="ThumbnailContainer">
        <Typography>{t('modal.world_settings.details.thumbnail')}</Typography>
        <div className="ThumbnailBackground">
          {worldSettings.thumbnail ? (
            <img
              className="ThumbnailImage"
              src={worldSettings.thumbnail}
              alt={t('modal.world_settings.details.thumbnail')}
            />
          ) : (
            <>
              <Typography>{t('modal.world_settings.details.no_image')}</Typography>
            </>
          )}
        </div>
        <Button
          component="label"
          variant="contained"
          color="secondary"
          startIcon={<FolderIcon />}
        >
          {worldSettings.thumbnail
            ? t('modal.world_settings.details.replace_image')
            : t('modal.world_settings.details.set_image')}
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleSelectThumbnail}
          />
        </Button>
      </Box>

      <InputLabel
        label={t('modal.world_settings.details.age_rating')}
        className="ColHalf"
      >
        <Select
          value={worldSettings.contentRating || ''}
          onChange={e => onChangeSettings({ contentRating: e.target.value as SceneAgeRating })}
        >
          {AGE_RATING_OPTIONS.map(option => (
            <MenuItem
              key={option.value}
              value={option.value}
            >
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </InputLabel>

      <InputLabel
        label={t('modal.world_settings.details.categories')}
        className="ColHalf"
      >
        <Select
          multiple
          maxSelected={3}
          value={worldSettings.categories || []}
          onChange={e =>
            onChangeSettings({
              categories: e.target.value.length ? (e.target.value as SceneCategory[]) : null,
            })
          }
        >
          {CATEGORIES_OPTIONS.map(option => (
            <MenuItem
              key={option.value}
              value={option.value}
            >
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </InputLabel>
    </Box>
  );
});

export { DetailsTab };
