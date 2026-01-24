import { useCallback, useEffect, useState } from 'react';

import { isValidHttpsUrl } from '../../lib/utils/url';
import { TextField } from '../ui/TextField';
import { Message, MessageType } from '../ui/Message';
import { Modal } from '../Modal';
import { Button } from '../Button';

import './UrlInputModal.css';

export interface UrlInputModalProps {
  isOpen: boolean;
  initialValue?: string;
  onClose: () => void;
  onAccept: (url: string) => void;
}

export function UrlInputModal({
  isOpen,
  initialValue = '',
  onClose,
  onAccept,
}: UrlInputModalProps) {
  const [urlValue, setUrlValue] = useState(initialValue);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (isOpen) {
      setUrlValue(initialValue);
      setError(undefined);
    }
  }, [isOpen, initialValue]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const url = event.target.value;
    setUrlValue(url);
    setError(url && !isValidHttpsUrl(url) ? 'Please enter a valid HTTPS URL' : undefined);
  }, []);

  const handleAccept = useCallback(() => {
    if (!urlValue || !isValidHttpsUrl(urlValue)) {
      setError('Please enter a valid HTTPS URL');
      return;
    }
    onAccept(urlValue);
  }, [urlValue, onAccept]);

  const handleClose = useCallback(() => {
    setUrlValue('');
    setError(undefined);
    onClose();
  }, [onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleClose}
      className="UrlInputModal"
    >
      <div className="UrlInputModalContent">
        <h3>Enter URL</h3>
        <TextField
          label="URL"
          placeholder="https://..."
          value={urlValue}
          onChange={handleChange}
          error={!!error}
        />
        {error && (
          <Message
            text={error}
            type={MessageType.ERROR}
          />
        )}
        <div className="UrlInputModalActions">
          <Button
            onClick={handleClose}
            size="big"
          >
            Cancel
          </Button>
          <Button
            type="danger"
            size="big"
            onClick={handleAccept}
            disabled={!urlValue || !!error}
          >
            Accept
          </Button>
        </div>
      </div>
    </Modal>
  );
}
