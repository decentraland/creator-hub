import React from 'react';
import { Button } from '../../../Button';
import { Modal } from '../../../Modal';
import type { Props } from './types';
import './styles.css';

export function CreateEditTagModal({ open, onClose }: Props) {
  return (
    <Modal
      isOpen={open}
      onRequestClose={onClose}
      className="CreateEditTagModal"
    >
      <h2>Create or edit tag</h2>
      <div className="actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button>Create</Button>
      </div>
    </Modal>
  );
}
