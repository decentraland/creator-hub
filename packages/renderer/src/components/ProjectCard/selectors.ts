import type { RootState } from '../../modules/store';
import { DeploymentStatus } from '../../modules/deployment';
import { PreviewType } from '../../modules/editor';
import type { Project } from '/shared/types/projects';

export function selectCard(_: RootState, project: Project) {
  const parcels = project.layout.cols * project.layout.rows;
  const type = PreviewType.POOL;

  return {
    parcels,
    deploymentStatus: DeploymentStatus.UNPUBLISHED,
    deployments: [],
    isUploading: false,
    hasError: false,
    type,
  };
}
