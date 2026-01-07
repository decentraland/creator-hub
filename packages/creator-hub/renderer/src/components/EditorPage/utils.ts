import type { Project } from '/shared/types/projects';
import type { Deployment } from '/@/modules/store/deployment/slice';
import { t } from '/@/modules/store/translation/utils';
import type { PublishOption } from './MenuOptions';

type GetPublishButtonTextParams = {
  loadingPublish: boolean;
  deployment?: Deployment;
};

export const getPublishButtonText = ({
  loadingPublish,
  deployment,
}: GetPublishButtonTextParams): string => {
  if (loadingPublish) {
    return t('modal.publish_project.deploy.deploying.step.loading');
  }

  if (deployment?.status === 'pending') {
    const { catalyst, assetBundle, lods } = deployment.componentsStatus;

    if (catalyst === 'pending') {
      return t('modal.publish_project.deploy.deploying.step.uploading');
    }
    if (assetBundle === 'pending') {
      return t('modal.publish_project.deploy.deploying.step.converting');
    }
    if (lods === 'pending') {
      return t('modal.publish_project.deploy.deploying.step.optimizing');
    }

    return t('modal.publish_project.deploy.deploying.step.loading');
  }

  return t('editor.header.actions.publish');
};

type GetPublishOptionsParams = {
  project?: Project;
  isDeploying: boolean;
  actions: {
    onPublishScene: () => void | Promise<void>;
    onDeployWorld: () => void | Promise<void>;
    onDeployLand: () => void | Promise<void>;
  };
};

export const getPublishOptions = ({
  project,
  isDeploying,
  actions,
}: GetPublishOptionsParams): PublishOption[] => {
  const options: PublishOption[] = [];
  const worldName = project?.worldConfiguration?.name;
  const landBase = project?.scene?.base;

  if (isDeploying) {
    options.push({
      id: 'publish-scene',
      label: t('editor.header.actions.publish_options.publish_scene'),
      action: actions.onPublishScene,
    });
  }

  if (worldName) {
    options.push({
      id: 'deploy-world',
      label: t('editor.header.actions.publish_options.republish_to_world', { name: worldName }),
      action: actions.onDeployWorld,
    });
  }

  if (!worldName && landBase && landBase !== '0,0') {
    options.push({
      id: 'deploy-land',
      label: t('editor.header.actions.publish_options.republish_to_land', { coords: landBase }),
      action: actions.onDeployLand,
    });
  }

  return options;
};
