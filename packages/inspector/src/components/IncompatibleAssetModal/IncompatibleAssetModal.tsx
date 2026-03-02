import React from 'react';
import { IoClose } from 'react-icons/io5';
import { Modal } from '../Modal';
import { Button } from '../Button';
import type { IncompatibleComponent } from '../../lib/sdk/operations/add-asset/compatibility';

import './IncompatibleAssetModal.css';

interface Props {
  assetName: string;
  incompatibleComponents: IncompatibleComponent[];
  onClose: () => void;
}

const IncompatibleAssetModal: React.FC<Props> = ({
  assetName,
  incompatibleComponents,
  onClose,
}) => {
  return (
    <Modal
      isOpen
      onRequestClose={onClose}
      className="IncompatibleAssetModal"
    >
      <header className="IncompatibleAssetModalHeader">
        <h2>Dependency Update Required</h2>
        <button
          className="CloseButton"
          onClick={onClose}
        >
          <IoClose size={24} />
        </button>
      </header>

      <div className="IncompatibleAssetModalBody">
        <p>
          <strong>"{assetName}"</strong> requires components that are not compatible with your
          current SDK version. Update your dependencies to use this asset.
        </p>
        <ul className="IncompatibleComponentList">
          {incompatibleComponents.map(({ name, reason }) => (
            <li key={name}>
              <code>{name}</code>
              <span className="IncompatibleReason">
                {reason === 'outdated-definition' ? ' — outdated definition' : ' — not available'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="IncompatibleAssetModalFooter">
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
};

export default React.memo(IncompatibleAssetModal);
