import { useCallback } from 'react';
import { Alert, Button, IconButton } from 'decentraland-ui2';
import NotificationImportantIcon from '@mui/icons-material/NotificationImportant';
import CloseIcon from '@mui/icons-material/Close';

import { t } from '/@/modules/store/translation/utils';
import { useEditor } from '/@/hooks/useEditor';
import { useWorkspace } from '/@/hooks/useWorkspace';

export function NewDependencyVersion({ onClose }: { onClose: () => void }) {
  const { project } = useEditor();
  const { updateSdkPackage } = useWorkspace();

  const handleClickUpdate = useCallback(() => {
    if (project) {
      updateSdkPackage(project.path);
    }
    onClose();
  }, [project]);

  const renderActions = useCallback(
    () => (
      <>
        <Button
          variant="text"
          onClick={handleClickUpdate}
        >
          {t('snackbar.new_dependency_version.actions.update')}
        </Button>
        <IconButton onClick={onClose}>
          <CloseIcon color="secondary" />
        </IconButton>
      </>
    ),
    [],
  );

  return (
    <Alert
      icon={<NotificationImportantIcon color="secondary" />}
      severity="info"
      action={renderActions()}
      sx={{ alignItems: 'center' }}
    >
      {t('snackbar.new_dependency_version.title')}
    </Alert>
  );
}

export function DependencyUpdatedAutomatically({ onClose }: { onClose: () => void }) {
  const renderActions = useCallback(
    () => (
      <Button
        variant="text"
        onClick={onClose}
      >
        {t('snackbar.dependency_updated_automatically.actions.update')}
      </Button>
    ),
    [],
  );

  return (
    <Alert
      icon={<NotificationImportantIcon color="secondary" />}
      severity="info"
      action={renderActions()}
      sx={{ alignItems: 'center' }}
    >
      {t('snackbar.dependency_updated_automatically.title')}
    </Alert>
  );
}
