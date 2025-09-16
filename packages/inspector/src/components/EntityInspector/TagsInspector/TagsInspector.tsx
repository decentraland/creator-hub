import React, { useCallback, useState } from 'react';
import './TagsInspector.css';
import { FaTag as TagIcon, FaPlus, FaPencilAlt as EditIcon } from 'react-icons/fa';
import { VscTrash as RemoveIcon } from 'react-icons/vsc';
import type { Entity } from '@dcl/ecs';
import type { Props as OptionProp } from '../../ui/Dropdown/Option/types';

import { withSdk } from '../../../hoc/withSdk';
import { Dropdown, type DropdownChangeEvent } from '../../ui/Dropdown';
import type { Tag } from '../../../lib/sdk/components/Tags';
import {
  getTagComponent,
  updateTagsForEntity,
  TagType,
  removeTag,
} from '../../../lib/sdk/components/Tags';
import { useComponentValue } from '../../../hooks/sdk/useComponentValue';
import { CreateEditTagModal } from './CreateEditTagModal';

const TagsInspector = withSdk<{ entity: Entity }>(({ entity, sdk }) => {
  const [open, setOpen] = useState(false);
  const [sceneTagsComponent] = useComponentValue(
    sdk.engine.RootEntity,
    getTagComponent(sdk.engine),
  );
  const [entityTagsComponent] = useComponentValue(entity, getTagComponent(sdk.engine));

  const sceneTags = sceneTagsComponent?.tags || [];
  const entityTags = entityTagsComponent?.tags || [];

  const handleCreateNewTag = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    setOpen(true);
  };

  const handleRemoveTag = (e: React.MouseEvent<SVGElement>, tag: Tag) => {
    e.preventDefault();
    e.stopPropagation();
    removeTag(sdk.engine, tag.name);
  };

  const handleEditTag = (e: React.MouseEvent<SVGElement>, tag: Tag) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('edit tag', tag);
  };

  const getTagOptions = () => {
    const options: OptionProp[] = sceneTags.map(tag => ({
      label: tag.name,
      value: tag.name,
      className: 'TagOption',
      rightIcon:
        tag.type === TagType.Custom ? (
          <>
            <RemoveIcon onClick={e => handleRemoveTag(e, tag)} />
            <EditIcon onClick={e => handleEditTag(e, tag)} />
          </>
        ) : null,
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
      const selectedTags = sceneTags.filter(tag => value.includes(tag.name));
      updateTagsForEntity(sdk.engine, entity, selectedTags);
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
          value={entityTags.map(tag => tag.name)}
          options={getTagOptions()}
        />
      </div>
      <CreateEditTagModal
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
});

export default TagsInspector;
