import React, { useState } from 'react';

import { Button } from '../../../Button';
import { TextField } from '../../../ui/TextField';
import { Modal } from '../../../Modal';
import { withSdk } from '../../../../hoc/withSdk';
import { createTag, renameTag } from '../../../../lib/sdk/components/Tags';

import type { Props } from './types';
import './styles.css';

const CreateEditTagModal = withSdk<Props>(({ open, onClose, sdk, tag }) => {
  const [tagName, setTagName] = useState(tag?.name || '');

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(event.target.value);
  };

  const handleSaveTag = async () => {
    if (tagName && tag?.name) {
      console.log('change tag name', tagName);
      renameTag(sdk.engine, tag.name, tagName);
      onClose();
    }
  };

  const handleCreateTag = async () => {
    if (tagName) {
      createTag(sdk.engine, tagName);
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
        {tag && <span>Editing tag {tag.name}</span>}
        <TextField
          label="Tag name"
          autoSelect
          value={tag?.name || ''}
          onChange={handleNameChange}
        />
      </div>
      <div className="actions">
        <Button
          size="big"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
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
