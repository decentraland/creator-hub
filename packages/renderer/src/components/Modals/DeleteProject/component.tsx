import { Modal } from 'decentraland-ui2/dist/components/Modal/Modal';

import { t } from '/@/modules/store/translation/utils';

import { Button } from '../../Button';

import type { Props } from './types';
import { useCallback } from 'react';

export function DeleteProject({ open, project, onClose, onSubmit }: Props) {
  const handleSubmit = useCallback(() => {
    onSubmit(project);
  }, []);

  return (
    <Modal
      open={open}
      title={`${t('scene_list.project_actions.delete_project')} "${project.title}"`}
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
      {t('modal.irreversible_operation')}
    </Modal>
  );
}
