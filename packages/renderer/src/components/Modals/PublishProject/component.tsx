import { useCallback, useState } from 'react';
import { Initial } from './steps/Initial';
import { AlternativeServers } from './steps/AlternativeServers';
import { PublishToWorld } from './steps/PublishToWorld';
import { PublishToLand } from './steps/PublishToLand';
import { Deploy } from './steps/Deploy';

import type { Props, Step } from './types';

export function PublishProject({ open, project, onClose }: Omit<Props, 'onStep'>) {
  const [step, setStep] = useState<Step>('initial');
  const [history, setHistory] = useState<Step[]>([]);

  const handleClose = useCallback(() => {
    setStep('initial');
    setHistory([]);
    onClose();
  }, [setStep, setHistory, onClose]);

  const handleBack = useCallback(() => {
    const prev = history.pop();
    setStep(prev || 'initial');
    setHistory(history => (history.length > 0 ? history.slice(0, -1) : []));
  }, [history, setStep, setHistory]);

  const handleStep = useCallback(
    (newStep: Step) => {
      setStep(newStep);
      setHistory(history => [...history, step]);
    },
    [step, setStep, setHistory],
  );

  const props: Props = {
    open,
    project,
    onClose: handleClose,
    onBack: handleBack,
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
