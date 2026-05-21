import { useCallback, useEffect, useState } from 'react';
import { Box, FormGroup, OutlinedInput, Typography } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';

import { Button } from '../../Button';
import { Modal, onBackNoop } from '..';

import './styles.css';

type Props = {
  open: boolean;
  existingFolderNames: string[];
  onClose: () => void;
  onSubmit: (name: string) => Promise<void> | void;
};

function sanitize(rawName: string): string {
  return rawName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function CreateCompositeModal({ open, existingFolderNames, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleClose = useCallback(
    (_event: unknown, reason?: 'backdropClick' | 'escapeKeyDown') => {
      if (reason === 'backdropClick' || submitting) return;
      onClose();
    },
    [onClose, submitting],
  );

  const validate = useCallback(
    (value: string): string | null => {
      const trimmed = value.trim();
      if (!trimmed) return t('editor.composites.create_modal.errors.empty');
      const folder = sanitize(trimmed);
      if (!folder) return t('editor.composites.create_modal.errors.invalid');
      if (existingFolderNames.includes(folder)) {
        return t('editor.composites.create_modal.errors.exists');
      }
      return null;
    },
    [existingFolderNames],
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setName(value);
      setError(validate(value));
    },
    [validate],
  );

  const handleSubmit = useCallback(async () => {
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(name.trim());
    } catch (err: any) {
      setError(err?.message ?? t('editor.composites.create_modal.errors.invalid'));
    } finally {
      setSubmitting(false);
    }
  }, [name, onSubmit, validate]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <Modal
      className="CreateCompositeModal"
      open={open}
      size="small"
      title={t('editor.composites.create_modal.title')}
      onBack={onBackNoop}
      onClose={handleClose}
      actions={
        <>
          <Button
            color="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            {t('modal.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !!error || !name.trim()}
          >
            {t('editor.composites.create_modal.submit')}
          </Button>
        </>
      }
    >
      <Box className="CreateCompositeBody">
        <FormGroup>
          <Typography variant="body1">{t('editor.composites.create_modal.label')}</Typography>
          <OutlinedInput
            autoFocus
            color="secondary"
            placeholder={t('editor.composites.create_modal.placeholder')}
            value={name}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          <Typography
            variant="caption"
            className="CreateCompositeDescription"
          >
            {t('editor.composites.create_modal.description')}
          </Typography>
          {error && (
            <Typography
              variant="body2"
              className="CreateCompositeError"
            >
              {error}
            </Typography>
          )}
        </FormGroup>
      </Box>
    </Modal>
  );
}
