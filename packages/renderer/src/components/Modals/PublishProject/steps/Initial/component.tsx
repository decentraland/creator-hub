import { OptionBox } from '/@/components/EditorPage/OptionBox';
import { t } from '/@/modules/store/translation/utils';
import LandPng from '/assets/images/land.png';
import WorldsPng from '/assets/images/worlds.png';
import type { Props } from '../../types';

import './styles.css';
import { useAuth } from '/@/hooks/useAuth';
import { Button } from 'decentraland-ui2';
import { PublishModal } from '../../PublishModal';

export function Initial(props: Props) {
  const { isSignedIn, signIn } = useAuth();
  let content = null;
  if (!isSignedIn) {
    content = (
      <div className="Initial">
        <p>You need to sign in before you can publish your scene.</p>
        <Button
          color="primary"
          variant="contained"
          onClick={signIn}
        >
          Sign In
        </Button>
      </div>
    );
  } else {
    content = (
      <div className="Initial">
        <div className="options">
          <OptionBox
            thumbnailSrc={WorldsPng}
            title={t('modal.publish_project.worlds.title')}
            description={t('modal.publish_project.worlds.description')}
            buttonText={t('modal.publish_project.worlds.action')}
            onClickPublish={() => props.onStep('publish-to-world')}
            learnMoreUrl="https://docs.decentraland.org/creator/worlds/about/#publish-a-world"
          />
          <OptionBox
            thumbnailSrc={LandPng}
            title={t('modal.publish_project.land.title')}
            description={t('modal.publish_project.land.description')}
            buttonText={t('modal.publish_project.land.action')}
            onClickPublish={() => props.onStep('publish-to-land')}
            learnMoreUrl="https://docs.decentraland.org/creator/development-guide/sdk7/publishing-permissions/#land-permission-options"
          />
        </div>
        <span
          className="alternative_servers"
          onClick={() => props.onStep('alternative-servers')}
        >
          {t('modal.publish_project.alternative_servers.title')}
        </span>
      </div>
    );
  }
  const { onBack: _, ...rest } = props;
  return (
    <PublishModal
      title={t('modal.publish_project.title', { title: props.project.title })}
      subtitle={t('modal.publish_project.select')}
      {...rest}
    >
      {content}
    </PublishModal>
  );
}
