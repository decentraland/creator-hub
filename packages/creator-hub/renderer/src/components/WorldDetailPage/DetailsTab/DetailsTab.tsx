import { useRef, useState } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import { MenuItem } from 'decentraland-ui2';

import { useDispatch } from '#store';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { SceneCategory, type WorldSettings } from '/@/lib/worlds';
import { actions as managementActions } from '/@/modules/store/management';
import { t } from '/@/modules/store/translation/utils';

import { useDraft } from '../../DetailShell';
import { menuSurfaceStyles } from '../../Dropdown/component.styled';
import { ChevronDownIcon, EditIcon } from '../../Icons';
import { DESCRIPTION_MAX, NAME_MAX } from '../../LandDetailPage/DetailsTab/details';
import { DetailsField } from '../../LandDetailPage/DetailsTab/DetailsField';
import { DomainSelect, Field, FieldTitle } from '../../LandDetailPage/DetailsTab/DetailsTab.styled';
import { Loader } from '../../Loader';
import { useWorldSettings } from '../useWorldSettings';
import { selectRowStyles } from '../../ManagePage/ViewBar/ViewBar.styled';
import {
  CheckSlot,
  Columns,
  EditButton,
  Form,
  NoImage,
  ThumbnailBox,
  ThumbnailColumn,
  ThumbnailHint,
  ThumbnailTitle,
} from './DetailsTab.styled';

const MAX_CATEGORIES = 3;
const MENU_GAP = 10;
const MENU_MARGIN = 16;
const CATEGORIES = Object.values(SceneCategory);

type Draft = {
  title: string;
  description: string;
  categories: SceneCategory[];
  thumbnail?: string;
};

const toDraft = (settings: WorldSettings): Draft => ({
  title: settings.title ?? '',
  description: settings.description ?? '',
  categories: settings.categories ?? [],
});

const categoryLabel = (category: SceneCategory) =>
  t(`world_detail.details.categories_options.${category}`);

const tooLong = (value: string, max: number) =>
  value.length > max ? { key: 'land_detail.details.too_long' as const, max } : null;

function changesOf(draft: Draft, saved: WorldSettings): Partial<WorldSettings> {
  const changes: Partial<WorldSettings> = {};
  if (draft.title !== (saved.title ?? '')) changes.title = draft.title;
  if (draft.description !== (saved.description ?? '')) changes.description = draft.description;
  if (draft.categories.join() !== (saved.categories ?? []).join())
    changes.categories = draft.categories.length ? draft.categories : null;
  if (draft.thumbnail) changes.thumbnail = draft.thumbnail;
  return changes;
}

function DetailsForm({ worldName, saved }: { worldName: string; saved: WorldSettings }) {
  const dispatch = useDispatch();
  const { pushGeneric } = useSnackbar();
  const fileInput = useRef<HTMLInputElement>(null);
  const [base, setBase] = useState(saved);
  const [draft, setDraft] = useState(() => toDraft(saved));
  const [saving, setSaving] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState<number>();

  if (saved !== base) {
    setBase(saved);
    setDraft(toDraft(saved));
  }

  const changes = changesOf(draft, saved);
  const errors = {
    name: tooLong(draft.title, NAME_MAX),
    description: tooLong(draft.description, DESCRIPTION_MAX),
  };

  useDraft({
    dirty: Object.keys(changes).length > 0,
    valid: !errors.name && !errors.description && !saving,
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

  const pickThumbnail = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft(current => ({ ...current, thumbnail: reader.result as string }));
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const thumbnail = draft.thumbnail ?? saved.thumbnail;

  return (
    <Columns>
      <Form>
        <DetailsField
          label={t('world_detail.details.name')}
          value={draft.title}
          max={NAME_MAX}
          error={errors.name}
          placeholder={t('land_detail.details.name_placeholder')}
          multiline="single"
          onChange={title => setDraft(current => ({ ...current, title }))}
        />
        <DetailsField
          label={t('world_detail.details.description')}
          value={draft.description}
          max={DESCRIPTION_MAX}
          error={errors.description}
          placeholder={t('world_detail.details.description_placeholder')}
          multiline="multi"
          onChange={description => setDraft(current => ({ ...current, description }))}
        />
        <Field>
          <FieldTitle as="span">{t('world_detail.details.categories')}</FieldTitle>
          <DomainSelect
            multiple
            value={draft.categories}
            IconComponent={ChevronDownIcon}
            inputProps={{ 'aria-label': t('world_detail.details.categories') }}
            renderValue={selected => (selected as SceneCategory[]).map(categoryLabel).join(', ')}
            onChange={event =>
              setDraft(current => ({
                ...current,
                categories: event.target.value as SceneCategory[],
              }))
            }
            onOpen={event => {
              const field = (event.currentTarget as HTMLElement).closest('.MuiInputBase-root');
              if (field)
                setMenuMaxHeight(
                  window.innerHeight -
                    field.getBoundingClientRect().bottom -
                    MENU_GAP -
                    MENU_MARGIN,
                );
            }}
            MenuProps={{
              anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
              transformOrigin: { vertical: 'top', horizontal: 'left' },
              slotProps: {
                paper: { sx: { marginTop: `${MENU_GAP}px`, maxHeight: menuMaxHeight } },
              },
              sx: [theme => menuSurfaceStyles({ theme }), theme => selectRowStyles({ theme })],
            }}
          >
            {CATEGORIES.map(category => (
              <MenuItem
                key={category}
                value={category}
                disabled={
                  draft.categories.length >= MAX_CATEGORIES && !draft.categories.includes(category)
                }
              >
                <CheckSlot className="MenuGlyph">
                  {draft.categories.includes(category) && <CheckIcon aria-hidden />}
                </CheckSlot>
                {categoryLabel(category)}
              </MenuItem>
            ))}
          </DomainSelect>
        </Field>
      </Form>
      <ThumbnailColumn>
        <ThumbnailTitle>{t('world_detail.details.thumbnail')}</ThumbnailTitle>
        <ThumbnailHint>{t('world_detail.details.thumbnail_hint')}</ThumbnailHint>
        <ThumbnailBox>
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={t('world_detail.details.thumbnail')}
            />
          ) : (
            <NoImage>{t('world_detail.details.no_image')}</NoImage>
          )}
          <EditButton
            disableFocusRipple
            aria-label={t('world_detail.details.change_thumbnail')}
            onClick={() => fileInput.current?.click()}
          >
            <EditIcon />
          </EditButton>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={pickThumbnail}
          />
        </ThumbnailBox>
      </ThumbnailColumn>
    </Columns>
  );
}

/** The World's name, description, categories and thumbnail, saved off-chain from the shell's SAVE. */
export function DetailsTab({ worldName }: { worldName: string }) {
  const settings = useWorldSettings(worldName);
  if (settings === 'failed') return null;
  if (settings === 'loading') return <Loader size={70} />;
  return (
    <DetailsForm
      worldName={worldName}
      saved={settings}
    />
  );
}
