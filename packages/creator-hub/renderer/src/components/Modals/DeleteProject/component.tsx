import { useCallback, useState } from 'react';

import { Box, Checkbox } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';

import { Modal } from '..';
import { Button } from '../../Button';

import type { Props } from './types';

import './styles.css';

export function DeleteProject({ open, project, onClose, onSubmit }: Props) {
  const [shouldDeleteFiles, setShouldDeleteFiles] = useState(false);

  const handleCheckboxChange = useCallback(
    (_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) =>
      setShouldDeleteFiles(checked),
    [],
  );
  const handleSubmit = useCallback(() => {
    onSubmit(project, shouldDeleteFiles);
  }, [shouldDeleteFiles, onSubmit, project]);

  return (
    <Modal
      open={open}
      title={t('modal.delete_project.title', { title: project.title })}
      onClose={onClose}
      size="tiny"
      actions={
        <>
          <Button
            color="secondary"
            onClick={onClose}
          >
            {t('modal.cancel')}
          </Button>
          <Button onClick={handleSubmit}>{t('modal.confirm')}</Button>
        </>
      }
    >
      <Box className="DeleteProjectModal">
        <p>{t('modal.delete_project.remove_imported_scene', { title: project.title })}</p>
        <label className="delete-files">
          <Checkbox
            value={shouldDeleteFiles}
            onChange={handleCheckboxChange}
          />
          <span>{t('modal.delete_project.files_checkbox')}</span>
        </label>
        {shouldDeleteFiles && (
          <p className="delete-files-warning">{t('modal.delete_project.files_warning')}</p>
        )}
      </Box>
    </Modal>
  );
}
