import { useCallback } from 'react';
import NotificationImportantIcon from '@mui/icons-material/NotificationImportant';
import CloseIcon from '@mui/icons-material/Close';
import { Alert, Button, IconButton } from 'decentraland-ui2';

import type { Project } from '/shared/types/projects';
import { t } from '/@/modules/store/translation/utils';
import { useWorkspace } from '/@/hooks/useWorkspace';

export function NewSdkSkillsVersion({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { updateSdkSkills } = useWorkspace();

  const handleClickUpdate = useCallback(() => {
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
            onClick={handleClickUpdate}
          >
            {t('snackbar.new_sdk_skills_version.actions.update')}
          </Button>
          <IconButton onClick={onClose}>
            <CloseIcon color="secondary" />
          </IconButton>
        </>
      }
      sx={{ alignItems: 'center' }}
    >
      {t('snackbar.new_sdk_skills_version.title')}
    </Alert>
  );
}
