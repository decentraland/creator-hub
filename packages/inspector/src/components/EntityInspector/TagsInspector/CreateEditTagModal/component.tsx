import React, { useState } from 'react';
import { Button } from '../../../Button';
import { TextField } from '../../../ui/TextField';
import { Modal } from '../../../Modal';
import { withSdk } from '../../../../hoc/withSdk';
import type { Props } from './types';
import './styles.css';

const CreateEditTagModal = withSdk<Props>(({ open, onClose, entityId, sdk }) => {
  const [tagName, setTagName] = useState('');

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(event.target.value);
  };

  const handleCreateTag = async () => {
    if (tagName) {
      sdk.operations.addTag(entityId, tagName);
      await sdk.operations.dispatch();
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
