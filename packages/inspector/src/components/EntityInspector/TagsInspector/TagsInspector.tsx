import React from 'react';
import './TagsInspector.css';
import { FaTag as TagIcon } from 'react-icons/fa';
import type { Entity } from '@dcl/ecs';
import { useEntityComponent } from '../../../hooks/sdk/useEntityComponent';
import { withSdk } from '../../../hoc/withSdk';
import { Dropdown } from '../../ui/Dropdown';

export type Props = {
  entity: Entity;
};

const TagsInspector: React.FC<Props> = ({ entity }) => {
  const { getComponents } = useEntityComponent();
  const entityComponents = Array.from(getComponents(entity, false)).map(([id, name]) => ({
    id,
    name,
  }));

  const tags = ['Tag01', 'Tag02', 'Tag03'];

  return (
    <div className="TagsInspector">
      <div className="header">
        Tags <TagIcon />
      </div>
      <div className="components-list">
        <Dropdown
          placeholder="Add tags"
          multiple
          options={tags.map(tag => ({
            label: tag,
            value: tag,
          }))}
        />
      </div>
    </div>
  );
};

export default withSdk(React.memo(TagsInspector));
