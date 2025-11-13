import { useCallback, useMemo } from 'react';
import { Typography } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';
import { useDeploy } from '/@/hooks/useDeploy';
import type { Deployment as DeploymentType } from '/@/modules/store/deployment/slice';
import type { Status } from '/@/lib/deploy';
import type { Step } from '/@/components/Step/types';
import { ConnectedSteps } from '/@/components/Step';
import { Loader } from '/@/components/Loader';
import { ExpandMore } from '/@/components/ExpandMore';

import { Modal } from '..';

import type { Props } from './types';
import {
  Container,
  CurrentBadge,
  DeploymentCard,
  DeploymentMeta,
  ErrorMessage,
  Header,
  HeaderLeft,
  NoDeployments,
  StepsContainer,
  Title,
} from './styled';

export function DeploymentHistory({ open, projectPath, onClose }: Props) {
  const { getDeployment, getDeploymentHistory } = useDeploy();
  const activeDeployment = getDeployment(projectPath);
  const history = getDeploymentHistory(projectPath);

  const sortedDeployments = useMemo(() => {
    const allDeployments = activeDeployment ? [activeDeployment, ...history] : history;
    return allDeployments.sort((a, b) => b.createdAt - a.createdAt);
  }, [activeDeployment, history]);

  return (
    <Modal
      open={open}
      title={t('modal.deployment_history.title')}
      onClose={onClose}
      size="large"
    >
      <Container>
        {sortedDeployments.length === 0 ? (
          <NoDeployments>
            <Typography variant="body2">{t('modal.deployment_history.no_deployments')}</Typography>
          </NoDeployments>
        ) : (
          sortedDeployments.map(deployment => (
            <Deployment
              key={deployment.id}
              deployment={deployment}
              isCurrent={activeDeployment?.id === deployment.id}
            />
          ))
        )}
      </Container>
    </Modal>
  );
}

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTargetLabel = (deployment: DeploymentType) => {
  if (deployment.info.isWorld) {
    return `${t('modal.deployment_history.world')}: ${deployment.info.title || 'Unknown'}`;
  }
  return `${t('modal.deployment_history.land')}: ${deployment.info.baseParcel || 'Unknown'}`;
};

function Deployment({
  deployment,
  isCurrent,
}: {
  deployment: DeploymentType;
  isCurrent?: boolean;
}) {
  const { componentsStatus, lastUpdated, error, info } = deployment;
  const { deriveOverallStatus } = useDeploy();
  const overallStatus = deriveOverallStatus(deployment);

  const getStepDescription = useCallback((status: Status) => {
    switch (status) {
      case 'pending':
        return t('modal.publish_project.deploy.deploying.step.loading');
      case 'failed':
        return t('modal.publish_project.deploy.deploying.step.failed');
      default:
        return undefined;
    }
  }, []);

  const steps: Step[] = useMemo(() => {
    const { catalyst, assetBundle, lods } = componentsStatus;
    const baseSteps = [
      {
        bulletText: '1',
        name: t('modal.publish_project.deploy.deploying.step.uploading'),
        description: getStepDescription(catalyst),
        state: catalyst,
      },
      {
        bulletText: '2',
        name: t('modal.publish_project.deploy.deploying.step.converting'),
        description: getStepDescription(assetBundle),
        state: assetBundle,
      },
    ];

    if (!info.isWorld) {
      baseSteps.push({
        bulletText: '3',
        name: t('modal.publish_project.deploy.deploying.step.optimizing'),
        description: getStepDescription(lods),
        state: lods,
      });
    }

    return baseSteps;
  }, [componentsStatus, getStepDescription, info.isWorld]);

  const title = useMemo(() => {
    if (overallStatus === 'failed') return t('modal.publish_project.deploy.deploying.failed');
    if (overallStatus === 'complete') return t('modal.publish_project.deploy.success.message');
    return t('modal.publish_project.deploy.deploying.publish');
  }, [overallStatus]);

  return (
    <DeploymentCard>
      <Header>
        <HeaderLeft>
          <Title>
            {overallStatus === 'failed' ? (
              <div className="Warning" />
            ) : overallStatus === 'pending' ? (
              <Loader />
            ) : null}
            <Typography variant="h5">{title}</Typography>
          </Title>
          {error && (
            <ErrorMessage>
              {error.message}
              {error.cause && (
                <ExpandMore
                  title={t('modal.publish_project.deploy.deploying.errors.details')}
                  text={error.cause}
                />
              )}
            </ErrorMessage>
          )}
          <DeploymentMeta>
            <span>{formatDate(lastUpdated)}</span>
            <span>{getTargetLabel(deployment)}</span>
          </DeploymentMeta>
        </HeaderLeft>
        {isCurrent && <CurrentBadge>{t('modal.deployment_history.current')}</CurrentBadge>}
      </Header>
      <StepsContainer>
        <ConnectedSteps steps={steps} />
      </StepsContainer>
    </DeploymentCard>
  );
}
