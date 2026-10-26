import { useSnackbar } from '/@/hooks/useSnackbar';
import { getLandName } from '/@/modules/store/management/utils';
import { t } from '/@/modules/store/translation/utils';
import type { ManagedProject } from '/shared/types/manage';

import { PlaceCard } from '../PlaceCard';
import { getRoleTag } from '../RoleTag';
import { getLandMenuOptions } from './landMenu';
import { Grid } from './LandProjectsList.styled';

type Props = {
  projects: ManagedProject[];
  onViewScenes: () => void;
  onTransfer: (project: ManagedProject) => void;
};

/** The LANDS tab's card grid. */
export function LandProjectsList({ projects, onViewScenes, onTransfer }: Props) {
  const { pushGeneric } = useSnackbar();
  const onUrlCopied = () => pushGeneric('success', t('snackbar.generic.url_copied'));

  return (
    <Grid>
      {projects.flatMap(project =>
        project.place
          ? [
              <PlaceCard
                key={project.id}
                name={getLandName(project)}
                place={project.place}
                role={getRoleTag(project.role)}
                status={project.deployment ? 'published' : 'unpublished'}
                thumbnail={project.deployment?.thumbnail}
                scenesCount={project.deployment?.scenesCount ?? 0}
                menuOptions={getLandMenuOptions(project, {
                  onTransfer: () => onTransfer(project),
                  onUrlCopied,
                })}
                onViewScenes={onViewScenes}
              />,
            ]
          : [],
      )}
    </Grid>
  );
}
