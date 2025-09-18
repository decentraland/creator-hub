import React, { useCallback, useState } from 'react';
import './TagsInspector.css';
import { FaTag as TagIcon, FaPlus, FaPencilAlt as EditIcon } from 'react-icons/fa';
import { VscTrash as RemoveIcon } from 'react-icons/vsc';
import { type Entity } from '@dcl/ecs';
import type { Props as OptionProp } from '../../ui/Dropdown/Option/types';

import { withSdk } from '../../../hoc/withSdk';
import { Dropdown, type DropdownChangeEvent } from '../../ui/Dropdown';
import { removeTag } from '../../../lib/sdk/components/Tags';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { CreateEditTagModal } from './CreateEditTagModal';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

const TagsInspector = withSdk<{ entity: Entity }>(({ entity, sdk }) => {
  const { Tags } = sdk.components;

  const [createEditModal, setCreateEditModal] = useState<{ isOpen: boolean; tag: string | null }>({
    isOpen: false,
    tag: null,
  });
  const [sceneTagsComponent] = useComponentValue(sdk.engine.RootEntity, Tags);
  const [entityTagsComponent] = useComponentValue(entity, Tags);

  const sceneTags = sceneTagsComponent?.tags || [];
  const entityTags = entityTagsComponent?.tags || [];

  const handleCreateNewTag = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    setCreateEditModal({ isOpen: true, tag: null });
  };

  const [tagToDelete, setTagToDelete] = useState<string | null>(null);

  const handleRemoveTag = (e: React.MouseEvent<SVGElement>, tag: string) => {
    e.preventDefault();
    e.stopPropagation();
    setTagToDelete(tag);
  };

  const handleConfirmDelete = () => {
    if (tagToDelete) {
      removeTag(sdk.engine, tagToDelete);
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
          <RemoveIcon onClick={e => handleRemoveTag(e, tag)} />
          <EditIcon onClick={e => handleEditTag(e, tag)} />
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
      if (Tags.getOrNull(entity)) {
        sdk.operations.updateValue(Tags, entity, { tags: selectedTags });
      } else {
        sdk.operations.addComponent(entity, Tags.componentId, { tags: selectedTags });
      }
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
        tag={createEditModal.tag}
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
