import React, { useCallback, useState } from 'react';
import './TagsInspector.css';
import { FaTag as TagIcon, FaPlus, FaPencilAlt as EditIcon } from 'react-icons/fa';
import { VscTrash as RemoveIcon } from 'react-icons/vsc';
import { type Entity } from '@dcl/ecs';
import type { Props as OptionProp } from '../../ui/Dropdown/Option/types';

import { withSdk } from '../../../hoc/withSdk';
import { Dropdown, type DropdownChangeEvent } from '../../ui/Dropdown';

import { getComponentValue, useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { CreateEditTagModal } from './CreateEditTagModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { analytics, Event } from '../../../lib/logic/analytics';
import { getAssetByModel } from '../../../lib/logic/catalog';

const TagsInspector = withSdk<{ entity: Entity }>(({ entity, sdk }) => {
  const { Tags } = sdk.components;

  const [createEditModal, setCreateEditModal] = useState<{ isOpen: boolean; tag: string | null }>({
    isOpen: false,
    tag: null,
  });
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [sceneTagsComponent] = useComponentValue(sdk.engine.RootEntity, Tags);
  const [entityTagsComponent] = useComponentValue(entity, Tags);

  const sceneTags = sceneTagsComponent?.tags || [];
  const entityTags = entityTagsComponent?.tags || [];

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
      const gltfContainer = getComponentValue(entity, sdk.components.GltfContainer);
      const asset = getAssetByModel(gltfContainer.src);
      if (Tags.getOrNull(entity)) {
        sdk.operations.updateValue(Tags, entity, { tags: selectedTags });
      } else {
        sdk.operations.addComponent(entity, Tags.componentId, { tags: selectedTags });
      }
      analytics.track(Event.ASSIGN_TAGS, {
        tagsName: selectedTags.join(','),
        itemId: asset?.id || '',
        itemPath: gltfContainer.src,
      });
      sdk.operations.dispatch();
    },
    [entity, sdk, sceneTags],
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
          value={entityTags}
          options={getTagOptions()}
        />
      </div>
      <CreateEditTagModal
        open={createEditModal.isOpen}
        onClose={() => setCreateEditModal({ isOpen: false, tag: null })}
        editingTag={createEditModal.tag}
        entity={entity}
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
