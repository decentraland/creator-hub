import React, { useCallback, useState } from 'react';
import './TagsInspector.css';
import { FaTag as TagIcon, FaPlus } from 'react-icons/fa';
import type { Entity } from '@dcl/ecs';

import { withSdk } from '../../../hoc/withSdk';
import { Dropdown, type DropdownChangeEvent } from '../../ui/Dropdown';
import { getTagComponent, updateTagsForEntity } from '../../../lib/sdk/components/Tags';
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
          options={[
            ...sceneTags.map(tag => ({ label: tag.name, value: tag.name })),
            {
              label: 'Create a new tag',
              value: 'create',
              isField: false,
              onClick: handleCreateNewTag,
              leftIcon: <FaPlus />,
              className: 'create-new-tag-option',
            },
          ]}
        />
      </div>
      <CreateEditTagModal
        entityId={entity}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
});

export default TagsInspector;
