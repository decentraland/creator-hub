import React, { useCallback, useMemo, useState } from 'react';
import './TagsInspector.css';
import { FaTag as TagIcon, FaPlus } from 'react-icons/fa';
import type { Entity } from '@dcl/ecs';

import { useEntityComponent } from '../../../hooks/sdk/useEntityComponent';
import { withSdk } from '../../../hoc/withSdk';
import { Dropdown, type DropdownChangeEvent } from '../../ui/Dropdown';
import { getSceneTags, updateTagsForEntity } from '../../../lib/sdk/components/Tags';
import { CreateEditTagModal } from './CreateEditTagModal';

const TagsInspector = withSdk<{ entity: Entity }>(({ entity, sdk }) => {
  const { getComponents } = useEntityComponent();
  const [open, setOpen] = useState(false);
  const entityComponents = Array.from(getComponents(entity, false).entries()).map(([id, name]) => ({
    id,
    name,
  }));

  const tags = useMemo(() => getSceneTags(sdk.engine), [entity]);

  const handleCreateNewTag = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    setOpen(true);
  };

  const handleTagChange = useCallback(
    ({ target: { value } }: DropdownChangeEvent) => {
      updateTagsForEntity(sdk.engine, entity, value[0]);
    },
    [entity, sdk],
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
          value={'h'}
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
