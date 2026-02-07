import { useCallback, useMemo, useState } from 'react';
import { Initial } from './steps/Initial';
import { AlternativeServers } from './steps/AlternativeServers';
import { PublishToWorld } from './steps/PublishToWorld';
import { PublishToLand } from './steps/PublishToLand';
import { Deploy } from './steps/Deploy';

import type { DeploymentMetadata, Props, Step } from './types';

export function PublishProject({
  open,
  project,
  onClose,
  initialStep = 'initial',
  disableGoBack = false,
}: Omit<Props, 'onStep' | 'deploymentMetadata'>) {
  const [history, setHistory] = useState<Step[]>([]);
  const [deploymentMetadata, setDeploymentMetadata] = useState<DeploymentMetadata>({});
  const step = useMemo<Step>(
    () => (history.length > 0 ? history[history.length - 1] : initialStep),
    [history, initialStep],
  );

  const handleClose = useCallback(() => {
    setHistory([]);
    onClose();
  }, [onClose]);

  const handleBack = useCallback(() => {
    setHistory(history => (history.length > 0 ? history.slice(0, -1) : []));
  }, []);

  const handleStep: Props['onStep'] = useCallback(
    (newStep, { resetHistory = false, deploymentMetadata } = {}) => {
      setHistory(history => (resetHistory ? [newStep] : [...history, newStep]));
      if (deploymentMetadata) {
        setDeploymentMetadata(prev => ({ ...prev, ...deploymentMetadata }));
      }
    },
    [],
  );

  const previousStep = history.length > 1 ? history[history.length - 2] : undefined;

  const props: Props = {
    open,
    project,
    disableGoBack,
    previousStep,
    deploymentMetadata,
    onClose: handleClose,
    onBack: disableGoBack ? undefined : handleBack,
    onStep: handleStep,
  };

  return (
    <>
      {step === 'initial' && <Initial {...props} />}
      {step === 'alternative-servers' && <AlternativeServers {...props} />}
      {step === 'publish-to-land' && <PublishToLand {...props} />}
      {step === 'publish-to-world' && <PublishToWorld {...props} />}
      {step === 'deploy' && <Deploy {...props} />}
    </>
  );
}
