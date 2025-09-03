import React, { useMemo } from 'react';
import './TagsInspector.css';
import { FaTag as TagIcon } from 'react-icons/fa';
import type { Entity } from '@dcl/ecs';
import { useEntityComponent } from '../../../hooks/sdk/useEntityComponent';
import { withSdk } from '../../../hoc/withSdk';
import { Dropdown } from '../../ui/Dropdown';
import './TagsInspector.css';

const TagsInspector = withSdk<{ entity: Entity }>(({ entity, sdk }) => {
  const TAG_PREFIX = 'tag::';

  const { getComponents, addComponent, removeComponent } = useEntityComponent();
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
  const tags = allComponents.filter(component => component.name.startsWith(TAG_PREFIX));
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

  const handleCreateNewTag = () => {
    console.log('Create new tag');
  };

  const handleTagChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newValues = event.target.value as unknown as string[];
    if (newValues.includes('create')) {
      handleCreateNewTag();
      return;
    }

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
          placeholder="Add tags"
          multiple
          onChange={handleTagChange}
          value={value}
          options={[...options, { label: 'Create a new tag', value: 'create' }]}
        />
      </div>
    </div>
  );
});

export default TagsInspector;
