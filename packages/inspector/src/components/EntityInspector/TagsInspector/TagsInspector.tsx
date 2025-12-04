import React, { useCallback, useMemo, useState } from 'react';
import { FaTag as TagIcon, FaPlus, FaPencilAlt as EditIcon } from 'react-icons/fa';
import { VscTrash as RemoveIcon } from 'react-icons/vsc';

import { withSdk } from '../../../hoc/withSdk';
import { getComponentValue, useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useMultiComponentInput } from '../../../hooks/sdk/useComponentInput';
import { Dropdown, type DropdownChangeEvent } from '../../ui/Dropdown';
import type { Props as OptionProp } from '../../ui/Dropdown/Option/types';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';

import { CreateEditTagModal } from './CreateEditTagModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { fromTags, toTags } from './utils';
import type { Props } from './types';
import './TagsInspector.css';

const TagsInspector = withSdk<Props>(({ entities, sdk }) => {
  const { Tags } = sdk.components;
  const entity = entities[0];

  const [createEditModal, setCreateEditModal] = useState<{ isOpen: boolean; tag: string | null }>({
    isOpen: false,
    tag: null,
  });
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [sceneTagsComponent] = useComponentValue(sdk.engine.RootEntity, Tags);

  // Memoize sceneTags - use content as key to detect changes even if array reference is the same
  const sceneTagsKey = sceneTagsComponent?.tags?.join(',') ?? '';
  const sceneTags = useMemo(
    () => [...(sceneTagsComponent?.tags ?? [])],
    [sceneTagsKey, sceneTagsComponent?.tags],
  );

  const { getInputProps } = useMultiComponentInput(entities, Tags, fromTags, toTags);
  const tagsInputProps = getInputProps('tags');
  const commonTags = Array.isArray(tagsInputProps.value) ? tagsInputProps.value : [];

  // Modal handlers
  const handleOpenCreateModal = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    setCreateEditModal({ isOpen: true, tag: null });
  }, []);

  const handleOpenEditModal = useCallback((e: React.MouseEvent<SVGElement>, tag: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCreateEditModal({ isOpen: true, tag });
  }, []);

  const handleCloseCreateEditModal = useCallback(() => {
    setCreateEditModal({ isOpen: false, tag: null });
  }, []);

  // Delete handlers
  const handleOpenDeleteModal = useCallback((e: React.MouseEvent<SVGElement>, tag: string) => {
    e.preventDefault();
    e.stopPropagation();
    setTagToDelete(tag);
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    setTagToDelete(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!tagToDelete) return;

    const entitiesWithTag = sdk.engine.getEntitiesByTag(tagToDelete);
    for (const ent of entitiesWithTag) {
      Tags.remove(ent, tagToDelete);
    }
    Tags.remove(sdk.engine.RootEntity, tagToDelete);

    void sdk.operations.dispatch();
    setTagToDelete(null);
  }, [tagToDelete, sdk.engine, sdk.operations, Tags]);

  // Tag change handlers
  const handleTagChange = useCallback(
    ({ target: { value } }: DropdownChangeEvent) => {
      // Use value directly - don't filter against sceneTags to avoid stale closure issues
      const selectedTags = Array.isArray(value) ? value : [];

      entities.forEach(ent => {
        if (!Tags.has(ent)) {
          sdk.operations.addComponent(ent, Tags.componentId, { tags: [] });
        }
      });

      tagsInputProps.onChange?.({ target: { value: selectedTags } } as any);

      const gltfContainer = getComponentValue(entity, sdk.components.GltfContainer);
      if (gltfContainer?.src) {
        const asset = getAssetByModel(gltfContainer.src);
        analytics.track(Event.ASSIGN_TAGS, {
          tagsName: selectedTags.join(','),
          itemId: asset?.id || '',
          itemPath: gltfContainer.src,
        });
      }
    },
    [tagsInputProps, entity, sdk, entities, Tags],
  );

  const handleTagCreated = useCallback(
    (tagName: string) => {
      handleTagChange({
        target: { value: [...commonTags, tagName] },
      } as DropdownChangeEvent);
    },
    [commonTags, handleTagChange],
  );

  // Memoized options - commonTags dependency ensures options refresh when entity tags change
  const tagOptions = useMemo((): OptionProp[] => {
    const options: OptionProp[] = sceneTags.map(tag => ({
      label: tag,
      value: tag,
      className: 'TagOption',
      rightIcon: (
        <>
          <EditIcon onClick={e => handleOpenEditModal(e, tag)} />
          <RemoveIcon onClick={e => handleOpenDeleteModal(e, tag)} />
        </>
      ),
    }));

    options.push({
      label: 'Create a new tag',
      value: 'create',
      isField: false,
      onClick: handleOpenCreateModal,
      leftIcon: <FaPlus />,
      className: 'AddTagOption',
    });

    return options;
  }, [sceneTags, handleOpenEditModal, handleOpenDeleteModal, handleOpenCreateModal]);

  return (
    <div className="TagsInspector">
      <div className="title">
        Tags <TagIcon />
      </div>
      <div className="tags-selector">
        <Dropdown
          placeholder="Add or create tags"
          multiple
          onChange={handleTagChange}
          value={commonTags}
          options={tagOptions}
        />
      </div>
      <CreateEditTagModal
        open={createEditModal.isOpen}
        onClose={handleCloseCreateEditModal}
        editingTag={createEditModal.tag}
        entity={entity}
        onTagCreated={handleTagCreated}
      />
      {tagToDelete && (
        <DeleteConfirmationModal
          tag={tagToDelete}
          open={!!tagToDelete}
          onClose={handleCloseDeleteModal}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
});

export default TagsInspector;
