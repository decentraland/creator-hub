import { Alert } from 'decentraland-ui2';

import { useSelector } from '#store';

import { Button } from '../../Button';

export function MissingScenes() {
  const missing = useSelector(state => state.workspace.missing);

  const renderActions = () => (
    <>
      <Button
        color="inherit"
        size="small"
        onClick={() => null}
      >
        View
      </Button>
      <Button
        color="inherit"
        size="small"
        onClick={() => null}
      >
        Discard all
      </Button>
    </>
  );

  return (
    <Alert
      severity="error"
      action={renderActions()}
    >
      {missing.length} missing scenes found
    </Alert>
  );
}
