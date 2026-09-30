import { Button } from 'decentraland-ui2';
import { OptionBox } from '/@/components/EditorPage/OptionBox';
import { t } from '/@/modules/store/translation/utils';
import LandPng from '/assets/images/land.png';
import WorldsPng from '/assets/images/worlds.png';

import { useAuth } from '/@/hooks/useAuth';
import { PublishModal } from '../../PublishModal';
import type { Props } from '../../types';
import './styles.css';

export function Initial(props: Props) {
  const { isSignedIn, signIn } = useAuth();
  const { onBack: _, ...rest } = props;
  if (!isSignedIn) {
    return (
      <PublishModal
        title={t('home.cards.sign_in.action')}
        subtitle={t('home.cards.sign_in.title')}
        size="tiny"
        {...rest}
      >
        <div
          className="Initial"
          data-testid="publish-modal-initial"
        >
          <Button
            color="primary"
            variant="contained"
            data-testid="publish-modal-initial-sign-in-button"
            onClick={signIn}
          >
            {t('home.cards.sign_in.action')}
          </Button>
        </div>
      </PublishModal>
    );
  } else {
    return (
      <PublishModal
        title={t('modal.publish_project.title', { title: props.project.title })}
        subtitle={t('modal.publish_project.select')}
        {...rest}
      >
        <div
          className="Initial"
          data-testid="publish-modal-initial"
        >
          <div
            className="options"
            data-testid="publish-modal-initial-options"
          >
            <OptionBox
              thumbnailSrc={WorldsPng}
              title={t('modal.publish_project.worlds.title')}
              description={t('modal.publish_project.worlds.description')}
              data-testid="publish-modal-initial-option-box-worlds"
              buttonText={t('modal.publish_project.worlds.action')}
              onClickPublish={() => props.onStep('publish-to-world')}
              learnMoreUrl="https://docs.decentraland.org/creator/worlds/about/#publish-a-world"
            />
            <OptionBox
              thumbnailSrc={LandPng}
              title={t('modal.publish_project.land.title')}
              description={t('modal.publish_project.land.description')}
              data-testid="publish-modal-initial-option-box-land"
              buttonText={t('modal.publish_project.land.action')}
              onClickPublish={() => props.onStep('publish-to-land')}
              learnMoreUrl="https://docs.decentraland.org/creator/scenes-sdk7/publishing/publishing-options#land-permission-options"
            />
          </div>
          <span
            className="alternative_servers"
            onClick={() => props.onStep('alternative-servers')}
          >
            {t('modal.publish_project.alternative_servers.title')}
          </span>
        </div>
      </PublishModal>
    );
  }
}
