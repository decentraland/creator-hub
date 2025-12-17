import React, { useState, useMemo, useCallback } from 'react';

import { Button } from '../../../Button';
import { analytics, Event } from '../../../../lib/logic/analytics';
import { TextField } from '../../../ui/TextField';
import { Modal } from '../../../Modal';
import { withSdk } from '../../../../hoc/withSdk';

import type { Props } from './types';
import './styles.css';

const CreateEditTagModal = withSdk<Props>(({ open, onClose, sdk, editingTag, onTagCreated }) => {
  const [newTagName, setTagName] = useState(editingTag || '');
  const { Tags } = sdk.components;
  const sceneTags = Tags.getOrNull(sdk.engine.RootEntity);

  const isDuplicatedTag = useMemo(() => {
    if (!newTagName) return false;
    if (editingTag) {
      return sceneTags?.tags.some(sceneTag => sceneTag === newTagName && sceneTag !== editingTag);
    }
    return sceneTags?.tags.some(t => t === newTagName);
  }, [newTagName, editingTag, sceneTags?.tags]);

  const handleNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(event.target.value);
  }, []);

  const handleSaveTag = useCallback(async () => {
    if (newTagName && editingTag) {
      const entitiesWithTag = sdk.engine.getEntitiesByTag(editingTag);
      for (const entity of entitiesWithTag) {
        Tags.remove(entity, editingTag);
        Tags.add(entity, newTagName);
      }
      Tags.remove(sdk.engine.RootEntity, editingTag);
      Tags.add(sdk.engine.RootEntity, newTagName);
      sdk.operations.dispatch();
      analytics.track(Event.CREATE_TAG, {
        tagName: newTagName,
      });
      setTagName('');
      onClose();
    }
  }, [newTagName, editingTag, sdk.engine, sdk.operations, Tags, onClose]);

  const handleCreateTag = useCallback(async () => {
    if (newTagName) {
      Tags.add(sdk.engine.RootEntity, newTagName);
      sdk.operations.dispatch();

      onTagCreated?.(newTagName);

      setTagName('');
      onClose();
    }
  }, [newTagName, sdk.engine.RootEntity, sdk.operations, Tags, onClose, onTagCreated]);

  return (
    <Modal
      isOpen={open}
      onRequestClose={onClose}
      className="CreateEditTagModal"
      overlayClassName="CreateEditTagModalOverlay"
    >
      <div className="content">
        <h2 className="title">{editingTag ? 'Edit tag' : 'Create tag'}</h2>
        <div>
          <TextField
            label="Tag name"
            autoSelect
            value={editingTag || ''}
            onChange={handleNameChange}
          />
          <div className="warning">{isDuplicatedTag && 'This tag already exists'}</div>
        </div>
      </div>

      <div className="actions">
        <Button
          size="big"
          type="danger"
          onClick={editingTag ? handleSaveTag : handleCreateTag}
          disabled={isDuplicatedTag}
        >
          {editingTag ? 'Save tag' : 'Create tag'}
        </Button>
        <Button
          size="big"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </Modal>
  );
});

export default CreateEditTagModal;
