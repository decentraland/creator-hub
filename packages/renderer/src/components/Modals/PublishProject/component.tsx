import { type ChangeEvent, useCallback, useState } from 'react';
import { MenuItem, Select, type SelectChangeEvent } from 'decentraland-ui2';
import { Modal } from 'decentraland-ui2/dist/components/Modal/Modal';

import { misc } from '#preload';
import { isUrl } from '/shared/utils';
import { t } from '/@/modules/store/translation/utils';

import GenesisPlazaPng from '/assets/images/genesis_plaza.png';
import LandPng from '/assets/images/land.png';
import WorldsPng from '/assets/images/worlds.png';

import { Button } from '../../Button';
import { OptionBox } from '../../Editor/OptionBox';

import type { AlternativeTarget, Step, StepProps, StepValue, Props } from './types';

import './styles.css';

export function PublishProject({ open, project, onSubmit, onClose }: Props) {
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
      title={t('modal.publish_project.title', { title: project?.title })}
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
      <span className="select">{t('modal.publish_project.select')}</span>
      <div className="options">
        <OptionBox
          thumbnailSrc={WorldsPng}
          title={t('modal.publish_project.worlds.title')}
          description={t('modal.publish_project.worlds.description')}
          buttonText={t('modal.publish_project.worlds.action')}
          onClickPublish={handleClick('worlds')}
          learnMoreUrl="https://docs.decentraland.org/creator/worlds/about/#publish-a-world"
        />
        <OptionBox
          thumbnailSrc={LandPng}
          title={t('modal.publish_project.land.title')}
          description={t('modal.publish_project.land.description')}
          buttonText={t('modal.publish_project.land.action')}
          onClickPublish={handleClick('land')}
          learnMoreUrl="https://docs.decentraland.org/creator/development-guide/sdk7/publishing-permissions/#land-permission-options"
        />
      </div>
      <span
        className="alternative_servers"
        onClick={onStepChange('alternative-servers')}
      >
        {t('modal.publish_project.alternative_servers.title')}
      </span>
    </div>
  );
}

function AlternativeServers({ onClick }: StepProps) {
  const [option, setOption] = useState<AlternativeTarget>('test');
  const [customUrl, setCustomUrl] = useState('');
  const [error, setError] = useState('');

  const handleClick = useCallback(() => {
    if (option === 'custom' && !isUrl(customUrl)) {
      return setError(t('modal.publish_project.alternative_servers.errors.url'));
    }
    const value: StepValue = { target: option, value: customUrl };
    onClick(value);
  }, [option, customUrl]);

  const handleChangeSelect = useCallback((e: SelectChangeEvent<AlternativeTarget>) => {
    setOption(e.target.value as AlternativeTarget);
  }, []);

  const handleChangeCustom = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (error) setError('');
      setCustomUrl(e.target.value);
    },
    [error],
  );

  const handleClickLearnMore = useCallback(() => {
    if (option === 'custom') {
      return misc.openExternal(
        'https://docs.decentraland.org/creator/development-guide/sdk7/publishing/#custom-servers',
      );
    }
    misc.openExternal(
      'https://docs.decentraland.org/creator/development-guide/sdk7/publishing/#the-test-server',
    );
  }, [option]);

  return (
    <div className="AlternativeServers">
      <span className="select">{t('modal.publish_project.select')}</span>
      <div className="box">
        <div className="selection">
          <div>
            <h3>{t('modal.publish_project.alternative_servers.title')}</h3>
            <Select
              variant="standard"
              value={option}
              onChange={handleChangeSelect}
            >
              <MenuItem value="test">
                {t('modal.publish_project.alternative_servers.options.test_server')}
              </MenuItem>
              <MenuItem value="custom">
                {t('modal.publish_project.alternative_servers.options.custom_server')}
              </MenuItem>
            </Select>
            {option === 'custom' && (
              <div className="custom_input">
                <span className="title">
                  {t('modal.publish_project.alternative_servers.custom_server_url')}
                </span>
                <input
                  value={customUrl}
                  onChange={handleChangeCustom}
                />
                <span className="error">{error}</span>
              </div>
            )}
          </div>
          <img
            className="thumbnail"
            src={GenesisPlazaPng}
          />
        </div>
        <div className="actions">
          <span
            className="learn-more"
            onClick={handleClickLearnMore}
          >
            {t('option_box.learn_more')}
          </span>
          <Button onClick={handleClick}>
            {t(`modal.publish_project.alternative_servers.action.${option}_server`)}
          </Button>
        </div>
      </div>
    </div>
  );
}
