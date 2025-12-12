import React, { useCallback, useMemo, useState } from 'react';
import { FaTag as TagIcon, FaPlus, FaPencilAlt as EditIcon } from 'react-icons/fa';
import { VscTrash as RemoveIcon } from 'react-icons/vsc';
import type { Entity } from '@dcl/ecs';
import { CrdtMessageType } from '@dcl/ecs';

import { withSdk } from '../../../hoc/withSdk';
import { getComponentValue, useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { useChange } from '../../../hooks/sdk/useChange';
import { Dropdown, type DropdownChangeEvent } from '../../ui/Dropdown';
import type { Props as OptionProp } from '../../ui/Dropdown/Option/types';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';
import { partitionByFrequency } from '../../../lib/utils/array';

import { CreateEditTagModal } from './CreateEditTagModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
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

  const entitiesSet = useMemo(() => new Set(entities), [entities]);

  // Counter to trigger re-computation when SDK changes
  const [updateKey, setUpdateKey] = useState(0);

  // Listen for SDK tag changes and trigger re-computation
  useChange(
    event => {
      if (event.component?.componentId !== Tags.componentId) return;
      if (!entitiesSet.has(event.entity)) return;
      if (event.operation !== CrdtMessageType.PUT_COMPONENT) return;
      setUpdateKey(k => k + 1);
    },
    [Tags.componentId, entitiesSet],
  );

  // Compute common and partial tags directly from SDK
  // Re-runs when entities change or when SDK triggers updateKey change
  const { commonTags, partialTags, entityTagsMap } = useMemo(() => {
    const map = new Map<Entity, string[]>();
    entities.forEach(ent => {
      const component = getComponentValue(ent, Tags);
      map.set(ent, component?.tags ?? []);
    });
    const tagArrays = Array.from(map.values());
    const { common, partial } = partitionByFrequency(tagArrays, entities.length);
    return { commonTags: common, partialTags: partial, entityTagsMap: map };
  }, [entities, Tags, entitiesSet, updateKey]);

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

  // Delete handlers (for scene-level tag deletion)
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

  // Remove tag from entities that have it (preserves other entity tags)
  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      entities.forEach(ent => {
        const tags = entityTagsMap.get(ent) ?? [];
        if (tags.includes(tagToRemove)) {
          const newTags = tags.filter(t => t !== tagToRemove);
          sdk.operations.updateValue(Tags, ent, { tags: newTags });
        }
      });
      void sdk.operations.dispatch();

      // Track analytics
      const gltfContainer = getComponentValue(entity, sdk.components.GltfContainer);
      if (gltfContainer?.src) {
        const asset = getAssetByModel(gltfContainer.src);
        analytics.track(Event.ASSIGN_TAGS, {
          tagsName: [...commonTags, ...partialTags].filter(t => t !== tagToRemove).join(','),
          itemId: asset?.id || '',
          itemPath: gltfContainer.src,
        });
      }
    },
    [
      entities,
      entityTagsMap,
      Tags,
      sdk.operations,
      entity,
      sdk.components.GltfContainer,
      commonTags,
      partialTags,
    ],
  );

  // Add tag to all selected entities
  const handleAddTag = useCallback(
    (tagToAdd: string) => {
      entities.forEach(ent => {
        if (!Tags.has(ent)) {
          sdk.operations.addComponent(ent, Tags.componentId, { tags: [tagToAdd] });
        } else {
          const tags = entityTagsMap.get(ent) ?? [];
          if (!tags.includes(tagToAdd)) {
            sdk.operations.updateValue(Tags, ent, { tags: [...tags, tagToAdd] });
          }
        }
      });
      void sdk.operations.dispatch();

      // Track analytics
      const gltfContainer = getComponentValue(entity, sdk.components.GltfContainer);
      if (gltfContainer?.src) {
        const asset = getAssetByModel(gltfContainer.src);
        analytics.track(Event.ASSIGN_TAGS, {
          tagsName: [...commonTags, ...partialTags, tagToAdd].join(','),
          itemId: asset?.id || '',
          itemPath: gltfContainer.src,
        });
      }
    },
    [
      entities,
      entityTagsMap,
      Tags,
      sdk.operations,
      entity,
      sdk.components.GltfContainer,
      commonTags,
      partialTags,
    ],
  );

  // Handle dropdown selection (for adding and removing tags)
  const handleDropdownChange = useCallback(
    (e: DropdownChangeEvent) => {
      const value = e.target.value;
      const selectedTags: string[] = Array.isArray(value) ? value : [];
      const allCurrentTags: string[] = [...commonTags, ...partialTags];

      // Find newly added tags (tags in selection but not in current)
      const newTags = selectedTags.filter(tag => !allCurrentTags.includes(tag));

      // Find removed tags (tags in current but not in selection)
      const removedTags = allCurrentTags.filter(tag => !selectedTags.includes(tag));

      // Add each new tag
      newTags.forEach(tag => {
        handleAddTag(tag);
      });

      // Remove each removed tag
      removedTags.forEach(tag => {
        handleRemoveTag(tag);
      });
    },
    [commonTags, partialTags, handleAddTag, handleRemoveTag],
  );

  const handleTagCreated = useCallback(
    (tagName: string) => {
      handleAddTag(tagName);
    },
    [handleAddTag],
  );

  // Create Set for O(1) lookup of partial tags
  const partialTagsSet = useMemo(() => new Set(partialTags), [partialTags]);

  // Memoized options for dropdown - partial tags get 'partial' className for gray styling
  const tagOptions = useMemo((): OptionProp[] => {
    const options: OptionProp[] = sceneTags.map(tag => {
      const isPartial = partialTagsSet.has(tag);
      return {
        label: tag,
        value: tag,
        className: isPartial ? 'TagOption partial' : 'TagOption',
        rightIcon: (
          <>
            <EditIcon onClick={e => handleOpenEditModal(e, tag)} />
            <RemoveIcon onClick={e => handleOpenDeleteModal(e, tag)} />
          </>
        ),
      };
    });

    options.push({
      label: 'Create a new tag',
      value: 'create',
      isField: false,
      onClick: handleOpenCreateModal,
      leftIcon: <FaPlus />,
      className: 'AddTagOption',
    });

    return options;
  }, [
    sceneTags,
    partialTagsSet,
    handleOpenEditModal,
    handleOpenDeleteModal,
    handleOpenCreateModal,
  ]);

  // All visible tag values for dropdown (common tags first, then partial)
  const allVisibleTags = useMemo(() => [...commonTags, ...partialTags], [commonTags, partialTags]);

  return (
    <div className="TagsInspector">
      <div className="title">
        Tags <TagIcon />
      </div>
      <div className="tags-selector">
        <Dropdown
          placeholder="Add or create tags"
          multiple
          onChange={handleDropdownChange}
          value={allVisibleTags}
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
