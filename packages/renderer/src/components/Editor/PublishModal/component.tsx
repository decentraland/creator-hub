import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from 'decentraland-ui2/dist/components/Modal/Modal';

import { t } from '/@/modules/store/translation/utils';

import GenesisPlazaPng from '/assets/images/genesis_plaza.png';
import LandPng from '/assets/images/land.png';
import WorldsPng from '/assets/images/worlds.png';

import { Button } from '../../Button';
import { Dropdown } from '../../Dropdown';
import { OptionBox } from '../OptionBox';

import { type Props } from './types';

import './styles.css';

type Step = 'initial' | 'alternative-servers';

export function PublishModal({ open, project, onClose }: Props) {
  const [step, setStep] = useState<Step>('initial');

  const handleChangeStep = useCallback(
    (step: Step) => () => {
      setStep(step);
    },
    [],
  );

  const handleClickPublish = useCallback((target: string) => {
    console.log('Publish to: ', target);
  }, []);

  return (
    <Modal
      open={open}
      title={t('editor.modal.publish.title', { title: project?.title })}
      onClose={onClose}
      size="small"
      onBack={step !== 'initial' ? handleChangeStep('initial') : undefined}
    >
      <div className="PublishModal">
        {step === 'initial' && (
          <PublishDefault
            onClick={handleClickPublish}
            onStepChange={handleChangeStep}
          />
        )}
        {step === 'alternative-servers' && <AlternativeServers onClick={handleClickPublish} />}
      </div>
    </Modal>
  );
}

type StepProps = { onClick: (target: string) => void };

function PublishDefault({
  onClick,
  onStepChange,
}: StepProps & { onStepChange: (step: Step) => () => void }) {
  const handleClick = useCallback(
    (target: 'worlds' | 'land') => () => {
      onClick(target);
    },
    [],
  );

  return (
    <div className="initial">
      <span className="select">{t('editor.modal.publish.select')}</span>
      <div className="options">
        <OptionBox
          thumbnailSrc={WorldsPng}
          title={t('editor.modal.publish.worlds.title')}
          description={t('editor.modal.publish.worlds.description')}
          buttonText={t('editor.modal.publish.worlds.action')}
          onClickPublish={handleClick('worlds')}
          learnMoreUrl="https://docs.decentraland.org/creator/worlds/about/#publish-a-world"
        />
        <OptionBox
          thumbnailSrc={LandPng}
          title={t('editor.modal.publish.land.title')}
          description={t('editor.modal.publish.land.description')}
          buttonText={t('editor.modal.publish.land.action')}
          onClickPublish={handleClick('land')}
          learnMoreUrl="https://docs.decentraland.org/creator/development-guide/sdk7/publishing-permissions/#land-permission-options"
        />
      </div>
      <span
        className="alternative_servers"
        onClick={onStepChange('alternative-servers')}
      >
        {t('editor.modal.publish.alternative_servers.title')}
      </span>
    </div>
  );
}

type AlternativeOption = 'test' | 'custom';

function AlternativeServers({ onClick }: StepProps) {
  const [option, setOption] = useState<AlternativeOption>('test');

  const handleClick = useCallback(() => {
    onClick(option);
  }, []);

  const OPTIONS = [
    {
      text: t('editor.modal.publish.alternative_servers.options.test_server'),
      handler: () => setOption('test'),
    },
    {
      text: t('editor.modal.publish.alternative_servers.options.custom_server'),
      handler: () => setOption('custom'),
    },
  ];

  return (
    <div className="alternative-servers">
      <span className="select">{t('editor.modal.publish.select')}</span>
      <div className="box">
        <div className="selection">
          <div>
            <h3>{t('editor.modal.publish.alternative_servers.title')}</h3>
            <Dropdown options={OPTIONS} />
          </div>
          <img
            className="thumbnail"
            src={GenesisPlazaPng}
          />
        </div>
        <div className="actions">
          <Link to="https://docs.decentraland.org/creator/development-guide/sdk7/publishing/#the-test-server">
            {t('option_box.learn_more')}
          </Link>
          <Button onClick={handleClick}>
            {t(`editor.modal.publish.alternative_servers.action.${option}_server`)}
          </Button>
        </div>
      </div>
    </div>
  );
}
