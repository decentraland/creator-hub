import type {RootState} from '/@/modules/store';
import type {Project} from '/shared/types/projects';

export function selectCard(_: RootState, project: Project) {
  const parcels = project.layout.cols * project.layout.rows;

  return {
    parcels,
  };
}
