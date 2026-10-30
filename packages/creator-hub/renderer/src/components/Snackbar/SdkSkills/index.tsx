import { useCallback } from 'react';
import NotificationImportantIcon from '@mui/icons-material/NotificationImportant';
import CloseIcon from '@mui/icons-material/Close';
import { Alert, Button, IconButton } from 'decentraland-ui2';

import type { Project } from '/shared/types/projects';
import { t } from '/@/modules/store/translation/utils';
import { useWorkspace } from '/@/hooks/useWorkspace';

export function SdkSkills({
  project,
  installed,
  onClose,
}: {
  project: Project;
  installed: boolean;
  onClose: () => void;
}) {
  const { updateSdkSkills } = useWorkspace();

  const handleClickAction = useCallback(() => {
    updateSdkSkills(project);
    onClose();
  }, [project, updateSdkSkills, onClose]);

  return (
    <Alert
      icon={<NotificationImportantIcon color="secondary" />}
      severity="info"
      action={
        <>
          <Button
            variant="text"
            onClick={handleClickAction}
          >
            {installed
              ? t('snackbar.sdk_skills.outdated.action')
              : t('snackbar.sdk_skills.missing.action')}
          </Button>
          <IconButton onClick={onClose}>
            <CloseIcon color="secondary" />
          </IconButton>
        </>
      }
      sx={{ alignItems: 'center' }}
    >
      {installed ? t('snackbar.sdk_skills.outdated.title') : t('snackbar.sdk_skills.missing.title')}
    </Alert>
  );
}
