import React, { useCallback, useState } from 'react';
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

  const sceneTags = sceneTagsComponent?.tags || [];
  const { getInputProps } = useMultiComponentInput(entities, Tags, fromTags, toTags);

  // Get the tags input props - now properly handles arrays!
  const tagsInputProps = getInputProps('tags');

  // The hook now returns the correct array value (intersection of all entity tags)
  const commonTags = Array.isArray(tagsInputProps.value) ? tagsInputProps.value : [];

  const handleCreateNewTag = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    setCreateEditModal({ isOpen: true, tag: null });
  };

  const handleRemoveTag = (e: React.MouseEvent<SVGElement>, tag: string) => {
    e.preventDefault();
    e.stopPropagation();
    setTagToDelete(tag);
  };

  const handleConfirmDelete = () => {
    if (tagToDelete) {
      const entitiesWithTag = sdk.engine.getEntitiesByTag(tagToDelete);
      for (const entity of entitiesWithTag) {
        Tags.remove(entity, tagToDelete);
      }
      Tags.remove(sdk.engine.RootEntity, tagToDelete);
      sdk.operations.dispatch();
      setTagToDelete(null);
    }
  };

  const handleEditTag = (e: React.MouseEvent<SVGElement>, tag: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCreateEditModal({ isOpen: true, tag });
  };

  const getTagOptions = () => {
    const options: OptionProp[] = sceneTags.map(tag => ({
      label: tag,
      value: tag,
      className: 'TagOption',
      rightIcon: (
        <>
          <EditIcon onClick={e => handleEditTag(e, tag)} />
          <RemoveIcon onClick={e => handleRemoveTag(e, tag)} />
        </>
      ),
    }));
    options.push({
      label: 'Create a new tag',
      value: 'create',
      isField: false,
      onClick: handleCreateNewTag,
      leftIcon: <FaPlus />,
      className: 'AddTagOption',
    });
    return options;
  };

  const handleTagChange = useCallback(
    ({ target: { value } }: DropdownChangeEvent) => {
      const selectedTags = sceneTags.filter(tag => value.includes(tag));

      // Ensure all entities have the Tags component before updating
      entities.forEach(entity => {
        if (!Tags.has(entity)) {
          sdk.operations.addComponent(entity, Tags.componentId, { tags: [] });
        }
      });

      // Call the hook's onChange - it handles dispatch automatically
      tagsInputProps.onChange?.({ target: { value: selectedTags } } as any);

      // Track analytics for the first entity
      const gltfContainer = getComponentValue(entity, sdk.components.GltfContainer);
      const asset = getAssetByModel(gltfContainer.src);

      analytics.track(Event.ASSIGN_TAGS, {
        tagsName: selectedTags.join(','),
        itemId: asset?.id || '',
        itemPath: gltfContainer.src,
      });
    },
    [tagsInputProps, entity, sdk, sceneTags, entities, Tags],
  );

  const handleTagCreated = useCallback(
    (tagName: string) => {
      const updatedTags = [...commonTags, tagName];

      handleTagChange({
        target: { value: updatedTags },
      } as DropdownChangeEvent);
    },
    [commonTags, handleTagChange],
  );

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
          options={getTagOptions()}
        />
      </div>
      <CreateEditTagModal
        open={createEditModal.isOpen}
        onClose={() => setCreateEditModal({ isOpen: false, tag: null })}
        editingTag={createEditModal.tag}
        entity={entity}
        onTagCreated={handleTagCreated}
      />
      {tagToDelete && (
        <DeleteConfirmationModal
          tag={tagToDelete}
          open={!!tagToDelete}
          onClose={() => setTagToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
});

export default TagsInspector;
