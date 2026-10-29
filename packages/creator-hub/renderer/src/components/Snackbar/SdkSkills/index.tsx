import { useCallback } from 'react';
import NotificationImportantIcon from '@mui/icons-material/NotificationImportant';
import CloseIcon from '@mui/icons-material/Close';
import { Alert, Button, IconButton } from 'decentraland-ui2';

import type { Project } from '/shared/types/projects';
import { t } from '/@/modules/store/translation/utils';
import { useWorkspace } from '/@/hooks/useWorkspace';

export function SdkSkills({ project, onClose }: { project: Project; onClose: () => void }) {
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
            {t('snackbar.sdk_skills.action')}
          </Button>
          <IconButton onClick={onClose}>
            <CloseIcon color="secondary" />
          </IconButton>
        </>
      }
      sx={{ alignItems: 'center' }}
    >
      {t('snackbar.sdk_skills.title')}
    </Alert>
  );
}
