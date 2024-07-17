import { type ChangeEvent, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { MenuItem, Select, type SelectChangeEvent } from 'decentraland-ui2';
import { Modal } from 'decentraland-ui2/dist/components/Modal/Modal';

import { t } from '/@/modules/store/translation/utils';

import GenesisPlazaPng from '/assets/images/genesis_plaza.png';
import LandPng from '/assets/images/land.png';
import WorldsPng from '/assets/images/worlds.png';

import { Button } from '../../Button';
import { OptionBox } from '../OptionBox';

import type { AlternativeTarget, Step, StepProps, StepValue, Props } from './types';

import './styles.css';

export function PublishModal({ open, project, onSubmit, onClose }: Props) {
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

  const handleClickPublish = useCallback((value: StepValue) => {
    onSubmit(value);
    close();
  }, []);

  return (
    <Modal
      open={open}
      title={t('editor.modal.publish.title', { title: project?.title })}
      onClose={handleClose}
      size="small"
      onBack={step !== 'initial' ? handleChangeStep('initial') : undefined}
    >
      {step === 'initial' && (
        <Initial
          onClick={handleClickPublish}
          onStepChange={handleChangeStep}
        />
      )}
      {step === 'alternative-servers' && <AlternativeServers onClick={handleClickPublish} />}
    </Modal>
  );
}

function Initial({
  onClick,
  onStepChange,
}: StepProps & { onStepChange: (step: Step) => () => void }) {
  const handleClick = useCallback(
    (target: 'worlds' | 'land') => () => {
      onClick({ target });
    },
    [],
  );

  return (
    <div className="Initial">
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

function AlternativeServers({ onClick }: StepProps) {
  const [option, setOption] = useState<AlternativeTarget>('test');
  const [customUrl, setCustomUrl] = useState<string>('');

  const handleClick = useCallback(() => {
    const value = { target: option, customUrl };
    onClick(value);
  }, [option, customUrl]);

  const handleChangeSelect = useCallback((e: SelectChangeEvent<AlternativeTarget>) => {
    setOption(e.target.value as AlternativeTarget);
  }, []);

  const handleChangeCustom = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setCustomUrl(e.target.value);
  }, []);

  return (
    <div className="AlternativeServers">
      <span className="select">{t('editor.modal.publish.select')}</span>
      <div className="box">
        <div className="selection">
          <div>
            <h3>{t('editor.modal.publish.alternative_servers.title')}</h3>
            <Select
              variant="standard"
              value={option}
              onChange={handleChangeSelect}
            >
              <MenuItem value="test">
                {t('editor.modal.publish.alternative_servers.options.test_server')}
              </MenuItem>
              <MenuItem value="custom">
                {t('editor.modal.publish.alternative_servers.options.custom_server')}
              </MenuItem>
            </Select>
            {option === 'custom' && (
              <div className="custom_input">
                <span>{t('editor.modal.publish.alternative_servers.custom_server_url')}</span>
                <input
                  value={customUrl}
                  onChange={handleChangeCustom}
                />
              </div>
            )}
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
