import React, { useCallback, useEffect, useState } from 'react';
import { VscCode as CodeIcon } from 'react-icons/vsc';

import { Modal } from '../../../Modal';
import { TextField } from '../../../ui';
import { Button } from '../../../Button';
import type { Props } from './types';

import './CreateScriptModal.css';

const DEFAULT_SCRIPT_NAME = 'NewScript';

export const CreateScriptModal: React.FC<Props> = ({ isOpen, onClose, onCreate, isValid }) => {
  const [scriptName, setScriptName] = useState(DEFAULT_SCRIPT_NAME);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      setError(isValid?.(scriptName) || undefined);
    }
  }, [isOpen, isValid, scriptName]);

  const handleCreate = useCallback(() => {
    if (scriptName.trim()) {
      onCreate(scriptName);
      setScriptName(DEFAULT_SCRIPT_NAME);
      setError(undefined);
    }
  }, [scriptName, onCreate]);

  const handleClose = useCallback(() => {
    setScriptName(DEFAULT_SCRIPT_NAME);
    setError(undefined);
    onClose();
  }, [onClose]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setScriptName(value);
      setError(isValid?.(value) || undefined);
    },
    [isValid],
  );

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleClose}
      className="CreateScriptModal"
      overlayClassName="CreateScriptModalOverlay"
    >
      <div className="CreateScriptModalContent">
        <h2 className="title">Create New Script</h2>
        <p className="subtitle">A new Script will be placed inside your Scene Assets folder.</p>

        <div className="script-preview">
          <label className="label">Script File</label>
          <div className="icon-container">
            <CodeIcon size={64} />
          </div>
          <TextField
            value={scriptName}
            onChange={handleChange}
            error={!!error}
          />
          {error && <span className="error-message">{error}</span>}
        </div>

        <div className="actions">
          <Button
            className="cancel-button"
            onClick={handleClose}
          >
            CANCEL
          </Button>
          <Button
            className="create-button"
            onClick={handleCreate}
            disabled={!scriptName.trim() || !!error}
          >
            CREATE
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateScriptModal;
