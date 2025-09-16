import React, { useCallback, useMemo, useState } from 'react';
import './TagsInspector.css';
import { FaTag as TagIcon, FaPlus } from 'react-icons/fa';
import type { Entity } from '@dcl/ecs';

import { withSdk } from '../../../hoc/withSdk';
import { Dropdown, type DropdownChangeEvent } from '../../ui/Dropdown';
import {
  getSceneTags,
  getTagsForEntity,
  updateTagsForEntity,
} from '../../../lib/sdk/components/Tags';
import { CreateEditTagModal } from './CreateEditTagModal';

const TagsInspector = withSdk<{ entity: Entity }>(({ entity, sdk }) => {
  const [open, setOpen] = useState(false);

  const tags = useMemo(() => getSceneTags(sdk.engine), [entity]);

  const entityTags = useMemo(() => getTagsForEntity(sdk.engine, entity), [entity, sdk]);

  const handleCreateNewTag = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    setOpen(true);
  };

  const handleTagChange = useCallback(
    ({ target: { value } }: DropdownChangeEvent) => {
      const selectedTags = tags.filter(tag => value.includes(tag.name));
      updateTagsForEntity(sdk.engine, entity, selectedTags);
    },
    [entity, sdk, tags],
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
            ...tags.map(tag => ({ label: tag.name, value: tag.name })),
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
