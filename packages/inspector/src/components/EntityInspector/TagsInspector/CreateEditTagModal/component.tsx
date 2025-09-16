import React, { useState } from 'react';

import { Button } from '../../../Button';
import { TextField } from '../../../ui/TextField';
import { Modal } from '../../../Modal';
import { withSdk } from '../../../../hoc/withSdk';
import { createTag } from '../../../../lib/sdk/components/Tags';

import type { Props } from './types';
import './styles.css';

const CreateEditTagModal = withSdk<Props>(({ open, onClose, sdk }) => {
  const [tagName, setTagName] = useState('');

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(event.target.value);
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
    >
      <h2>Create tag</h2>
      <TextField
        label="Tag name"
        autoSelect
        value={tagName}
        onChange={handleNameChange}
      />
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={handleCreateTag}>Create</Button>
    </Modal>
  );
});

export default CreateEditTagModal;
