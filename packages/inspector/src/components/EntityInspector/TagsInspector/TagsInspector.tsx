import React, { useMemo, useState } from 'react';
import './TagsInspector.css';
import { FaTag as TagIcon, FaPlus } from 'react-icons/fa';
import type { Entity } from '@dcl/ecs';
import type { Tags } from '@dcl/asset-packs';

import { useEntityComponent } from '../../../hooks/sdk/useEntityComponent';
import { withSdk } from '../../../hoc/withSdk';
import { Dropdown } from '../../ui/Dropdown';
import CreateEditTagModal from './CreateEditTagModal';
import { TAG_PREFIX, DEFAULT_TAGS, type Tag } from './types';

const TagsInspector = withSdk<{ entity: Entity }>(({ entity, sdk }) => {
  const { getComponents, addComponent, removeComponent } = useEntityComponent();
  const [open, setOpen] = useState(false);
  const entityComponents = Array.from(getComponents(entity, false).entries()).map(([id, name]) => ({
    id,
    name,
  }));

  const allComponents = useMemo(() => {
    const ids = new Set<number>();
    const components: Array<{ id: number; name: string }> = [];

    for (const component of sdk.engine.componentsIter()) {
      if (!ids.has(component.componentId)) {
        ids.add(component.componentId);
        components.push({
          id: component.componentId,
          name: component.componentName,
        });
      }
    }
    return components;
  }, [sdk.engine]);

  const removePrefix = (name: string) => name.replace(TAG_PREFIX, '');
  const tags: Tag[] = allComponents
    .filter(component => component.name.startsWith(TAG_PREFIX))
    ?.map(tag => ({
      id: tag.id,
      name: tag.name,
      isDefault: DEFAULT_TAGS.includes(tag.name as Tags),
    }));

  const entityTags = entityComponents.filter(component => component.name.startsWith(TAG_PREFIX));

  const value = entityTags.map(tag => tag.id.toString());
  const options = tags.map(tag => ({
    label: removePrefix(tag.name),
    value: tag.id.toString(),
  }));

  console.log('ALL COMPONENTS', allComponents);
  console.log('TAGS COMPONENTS', tags);
  console.log('ENTITY TAGS COMPONENTS', entityTags);

  if (tags.length === 0) {
    return null;
  }

  const handleCreateNewTag = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    setOpen(true);
  };

  const handleTagChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newValues = event.target.value as unknown as string[];

    const newValuesAsNumbers = newValues.map(option => Number(option));
    const currentValues = value.map(Number);

    const tagsToAdd = newValuesAsNumbers.filter(id => !currentValues.includes(id));
    const tagsToRemove = currentValues.filter(id => !newValuesAsNumbers.includes(id));

    for (const tagId of tagsToAdd) {
      addComponent(entity, tagId);
    }

    for (const tagId of tagsToRemove) {
      const component = sdk.engine.getComponentOrNull(tagId);
      if (component) {
        removeComponent(entity, component as any);
      }
    }

    void sdk.operations.dispatch();
  };

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
          value={value}
          options={[
            ...options,
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
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
});

export default TagsInspector;
