import { type ChangeEvent, useCallback, useState } from 'react';
import { Button } from 'decentraland-ui2';

import { misc } from '#preload';

import { isUrl } from '/shared/utils';

import { t } from '/@/modules/store/translation/utils';
import { useEditor } from '/@/hooks/useEditor';

import GenesisPlazaPng from '/assets/images/genesis_plaza.webp';

import { PublishModal } from '../../PublishModal';
import type { Props } from '../../types';

import './styles.css';

export function AlternativeServers(props: Props) {
  const { publishScene } = useEditor();
  const [customUrl, setCustomUrl] = useState('');
  const [error, setError] = useState('');

  const handleClick = useCallback(() => {
    if (!isUrl(customUrl)) {
      return setError(t('modal.publish_project.alternative_servers.errors.url'));
    }
    void publishScene({ target: customUrl });
    props.onStep('deploy');
  }, [customUrl, props.onStep, publishScene]);

  const handleChangeCustom = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (error) setError('');
      setCustomUrl(e.target.value);
    },
    [error],
  );

  const handleClickLearnMore = useCallback(() => {
    misc.openExternal(
      'https://docs.decentraland.org/creator/scenes-sdk7/publishing/publishing#custom-servers',
    );
  }, []);

  return (
    <PublishModal
      title={t('modal.publish_project.alternative_servers.title')}
      subtitle={t('modal.publish_project.select')}
      {...props}
    >
      <div className="AlternativeServers">
        <div className="box">
          <div className="selection">
            <div>
              <h3>{t('modal.publish_project.alternative_servers.list')}</h3>
              <span className="server_name">
                {t('modal.publish_project.alternative_servers.options.custom_server')}
              </span>
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
              {t('modal.publish_project.alternative_servers.action.custom_server')}
            </Button>
          </div>
        </div>
      </div>
    </PublishModal>
  );
}
