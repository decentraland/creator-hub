import { useCallback, useState } from 'react';
import { Modal } from 'decentraland-ui2/dist/components/Modal/Modal';
import { t } from '/@/modules/store/translation/utils';
import { useAuth } from '/@/hooks/useAuth';
import { Initial } from './Initial';
import { AlternativeServers } from './AlternativeServers';
import { PublishToWorld } from './PublishToWorld';
import { PublishToLand } from './PublishToLand';
import { Deploy } from './Deploy';

import type { Target, Props, Step } from './types';

export function PublishProject({ open, project, onTarget, onClose }: Props) {
  const [step, setStep] = useState<Step>('initial');
  const [history, setHistory] = useState<Step[]>([]);
  const { isSignedIn } = useAuth();

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

  const handleChangeStep = useCallback(
    (newStep: Step) => {
      setStep(newStep);
      setHistory(history => [...history, step]);
    },
    [step, setStep, setHistory],
  );

  const handleTarget = useCallback(
    (value: Target) => {
      onTarget(value);
      handleChangeStep('deploy');
    },
    [onTarget, handleChangeStep],
  );

  return (
    <Modal
      open={open}
      title={
        isSignedIn
          ? step !== 'publish-to-world'
            ? t('modal.publish_project.title', { title: project.title })
            : ''
          : 'Sign In'
      }
      onClose={handleClose}
      size="small"
      onBack={history.length > 0 ? handleBack : undefined}
    >
      {step === 'initial' && <Initial onStepChange={handleChangeStep} />}
      {step === 'alternative-servers' && <AlternativeServers onTarget={handleTarget} />}
      {step === 'publish-to-land' && <PublishToLand onTarget={handleTarget} />}
      {step === 'publish-to-world' && <PublishToWorld onTarget={handleTarget} />}
      {step === 'deploy' && <Deploy />}
    </Modal>
  );
}
