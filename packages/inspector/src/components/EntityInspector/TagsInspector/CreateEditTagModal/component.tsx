import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Button } from '../../../Button';
import { TextField } from '../../../ui/TextField';
import { Modal } from '../../../Modal';
import { withSdk } from '../../../../hoc/withSdk';
import { addCustomComponentAction } from '../../../../redux/sdk';

import { TAG_PREFIX } from '../types';
import type { Props } from './types';
import './styles.css';

const CreateEditTagModal = withSdk<Props>(({ open, onClose, entityId, sdk }) => {
  const dispatch = useDispatch();
  const [tagName, setTagName] = useState('');

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(event.target.value);
  };

  const handleCreateTag = async () => {
    if (tagName) {
      const name = `${TAG_PREFIX}${tagName}`;
      console.log('Modal: creating tag', { name });
      dispatch(addCustomComponentAction({ name }));
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
