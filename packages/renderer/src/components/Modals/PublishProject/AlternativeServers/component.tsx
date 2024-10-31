import { type ChangeEvent, useCallback, useState } from 'react';
import { Button, MenuItem, Select, type SelectChangeEvent } from 'decentraland-ui2';
import { misc } from '#preload';
import { t } from '/@/modules/store/translation/utils';
import { isUrl } from '/shared/utils';
import GenesisPlazaPng from '/assets/images/genesis_plaza.png';
import type { AlternativeTarget, Target } from '../types';

import './styles.css';

export function AlternativeServers({ onTarget }: { onTarget: (target: Target) => void }) {
  const [option, setOption] = useState<AlternativeTarget>('test');
  const [customUrl, setCustomUrl] = useState('');
  const [error, setError] = useState('');

  const handleClick = useCallback(() => {
    if (option === 'custom' && !isUrl(customUrl)) {
      return setError(t('modal.publish_project.alternative_servers.errors.url'));
    }
    const value: Target = { target: option, value: customUrl };
    onTarget(value);
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
            <h3>{t('modal.publish_project.alternative_servers.list')}</h3>
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
