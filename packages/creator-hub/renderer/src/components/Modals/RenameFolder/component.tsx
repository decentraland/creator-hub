import { useCallback, useEffect, useState } from 'react';
import { OutlinedInput, Typography, FormGroup, CircularProgress as Loader } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';
import { getBaseName, isValidFolderName } from '/shared/utils';

import { Modal } from '..';
import { Button } from '../../Button';

import type { Props } from './types';

import './styles.css';

export function RenameFolder({ open, project, onClose, onSubmit }: Props) {
  const currentName = getBaseName(project.path);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset the field whenever the modal is (re)opened for a project.
  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
      setLoading(false);
    }
  }, [open, currentName]);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setName(event.target.value);
  }, []);

  const trimmedName = name.trim();
  const isUnchanged = trimmedName === currentName;
  const isInvalid = trimmedName.length > 0 && !isValidFolderName(trimmedName);

  const handleSubmit = useCallback(async () => {
    if (isUnchanged || isInvalid || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit(project, trimmedName);
      onClose();
    } catch (_error) {
      setError(t('modal.rename_folder.errors.rename_failed'));
      setLoading(false);
    }
  }, [onSubmit, onClose, project, trimmedName, isUnchanged, isInvalid, loading]);

  return (
    <Modal
      open={open}
      title={t('modal.rename_folder.title')}
      size="tiny"
      className="RenameFolderModal"
      onClose={onClose}
      actions={
        <>
          <Button
            color="secondary"
            onClick={onClose}
          >
            {t('modal.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || isUnchanged || isInvalid}
          >
            {loading ? <Loader size={20} /> : t('modal.confirm')}
          </Button>
        </>
      }
    >
      <FormGroup className="RenameFolderFormControl">
        <Typography variant="body1">{t('modal.rename_folder.field_label')}</Typography>
        <OutlinedInput
          color="secondary"
          value={name}
          onChange={handleChange}
          autoFocus
        />
        {isInvalid && (
          <Typography
            variant="body1"
            className="error"
          >
            {t('modal.rename_folder.errors.invalid_name')}
          </Typography>
        )}
        {error && (
          <Typography
            variant="body1"
            className="error"
          >
            {error}
          </Typography>
        )}
      </FormGroup>
    </Modal>
  );
}
