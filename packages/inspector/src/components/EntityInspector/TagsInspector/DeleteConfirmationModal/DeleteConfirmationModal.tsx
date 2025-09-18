import React from 'react';

import { Modal } from '../../../Modal';
import { Button } from '../../../Button';
import { withSdk } from '../../../../hoc/withSdk';
import './styles.css';

import type { DeleteConfirmationModalProps } from './types';

export const DeleteConfirmationModal = withSdk<DeleteConfirmationModalProps>(
  ({ tag, open, onClose, onConfirm, sdk }) => {
    const { Tags } = sdk.components;
    const entitiesCount = Array.from(sdk.engine.getEntitiesByTag(tag)).length;

    return (
      <Modal
        isOpen={open}
        onRequestClose={onClose}
        className="DeleteConfirmationModal"
        overlayClassName="DeleteConfirmationModalOverlay"
      >
        <div className="content">
          <h2 className="title">Delete tag</h2>
          <div className="description">
            Deleting "{tag}" will remove it from the tag list and from every associated entity
            within this scene.
          </div>
          {entitiesCount > 0 && (
            <div className="warning">
              This tag is currently used by {entitiesCount}{' '}
              {entitiesCount === 1 ? 'entity' : 'entities'}
            </div>
          )}
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
            onClick={onConfirm}
          >
            Remove
          </Button>
        </div>
      </Modal>
    );
  },
);
