import React, { useState } from 'react';

import { Button } from '../../../Button';
import { TextField } from '../../../ui/TextField';
import { Modal } from '../../../Modal';
import { withSdk } from '../../../../hoc/withSdk';

import type { Props } from './types';
import './styles.css';

const CreateEditTagModal = withSdk<Props>(({ open, onClose, sdk, tag }) => {
  const [newTagName, setTagName] = useState(tag || '');
  const { Tags } = sdk.components;
  const sceneTags = Tags.getOrNull(sdk.engine.RootEntity);

  const isDuplicatedTag = () => {
    return sceneTags?.tags.some(t => t === newTagName);
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(event.target.value);
  };

  const handleSaveTag = async () => {
    if (newTagName && tag) {
      const entitiesWithTag = sdk.engine.getEntitiesByTag(tag);
      for (const entity of entitiesWithTag) {
        Tags.remove(entity, tag);
        Tags.add(entity, newTagName);
      }
      Tags.remove(sdk.engine.RootEntity, tag);
      Tags.add(sdk.engine.RootEntity, newTagName);
      sdk.operations.dispatch();
      onClose();
    }
  };

  const handleCreateTag = async () => {
    //TODO: validate no repeat names :)
    if (newTagName) {
      console.log('ALE: createTag called', newTagName);
      Tags.add(sdk.engine.RootEntity, newTagName);
      sdk.operations.dispatch();
      onClose();
    }
  };

  return (
    <Modal
      isOpen={open}
      onRequestClose={onClose}
      className="CreateEditTagModal"
      overlayClassName="CreateEditTagModalOverlay"
    >
      <div className="content">
        <h2 className="title">{tag ? 'Edit tag' : 'Create tag'}</h2>
        {tag && <span>Editing tag {tag}</span>}
        <div>
          <TextField
            label="Tag name"
            autoSelect
            value={tag || ''}
            onChange={handleNameChange}
          />
          <div className="warning">{isDuplicatedTag() && 'This tag already exists'}</div>
        </div>
      </div>

      <div className="actions">
        <Button
          size="big"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          disabled={isDuplicatedTag()}
          size="big"
          type="danger"
          onClick={tag ? handleSaveTag : handleCreateTag}
        >
          {tag ? 'Save tag' : 'Create tag'}
        </Button>
      </div>
    </Modal>
  );
});

export default CreateEditTagModal;
