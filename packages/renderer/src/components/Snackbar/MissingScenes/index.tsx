import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'decentraland-ui2';

import { useWorkspace } from '/@/hooks/useWorkspace';

import { Button } from '../../Button';
import { MissingProjects } from '../../Modals/MissingProjects';

export function MissingScenes({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const { unlistProjects, missing } = useWorkspace();

  useEffect(() => {
    if (missing.length === 0) onClose();
  }, [missing]);

  const handleModal = useCallback(
    (value: boolean) => () => {
      setOpen(value);
    },
    [],
  );

  const handleDiscardAll = useCallback(() => {
    unlistProjects(missing);
  }, []);

  const renderActions = () => (
    <>
      <Button
        color="inherit"
        size="small"
        onClick={handleModal(true)}
      >
        View
      </Button>
      <Button
        color="inherit"
        size="small"
        onClick={handleDiscardAll}
      >
        Discard all
      </Button>
    </>
  );

  return (
    <>
      <Alert
        severity="error"
        action={renderActions()}
      >
        {missing.length} missing scenes found
      </Alert>
      <MissingProjects
        open={open}
        onClose={handleModal(false)}
      />
    </>
  );
}
