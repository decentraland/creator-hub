import type { DeploymentStatus } from '../../modules/deployment';

export type Props = {
  className?: string;
  status?: DeploymentStatus | null;
  projectId: string;
  type?: 'project' | 'public' | 'pool';
};
