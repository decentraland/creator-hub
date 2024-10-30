import { useCallback, useState } from 'react';
import { Modal } from 'decentraland-ui2/dist/components/Modal/Modal';
import { t } from '/@/modules/store/translation/utils';
import { Initial } from './Initial';
import { AlternativeServers } from './AlternativeServers';
import { PublishToWorld } from './PublishToWorld';
import { PublishToLand } from './PublishToLand';
import { Deploy } from './Deploy';

import type { TargetValue, Props, Step } from './types';

export function PublishProject({ open, project, onTarget, onClose }: Props) {
  const [step, setStep] = useState<Step>('initial');

  const close = useCallback(() => {
    setStep('initial');
    onClose();
  }, []);

  const handleClose = useCallback(() => close(), []);

  const handleChangeStep = useCallback(
    (step: Step) => () => {
      setStep(step);
    },
    [],
  );

  const handleTarget = useCallback((value: TargetValue) => {
    onTarget(value);
    setStep('deploy');
  }, []);

  return (
    <Modal
      open={open}
      title={
        step !== 'publish-to-world'
          ? t('modal.publish_project.title', { title: project.title })
          : ''
      }
      onClose={handleClose}
      size="small"
      onBack={step !== 'initial' ? handleChangeStep('initial') : undefined}
    >
      {step === 'initial' && <Initial onStepChange={handleChangeStep} />}
      {step === 'alternative-servers' && <AlternativeServers onTarget={handleTarget} />}
      {step === 'publish-to-land' && <PublishToLand onTarget={handleTarget} />}
      {step === 'publish-to-world' && <PublishToWorld onTarget={handleTarget} />}
      {step === 'deploy' && <Deploy />}
    </Modal>
  );
}
