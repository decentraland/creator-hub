import { useCallback } from 'react';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import cx from 'classnames';

import { useSelector } from '/@/modules/store';
import { t } from '/@/modules/store/reducers/translation/utils';

import { Dropdown } from '../Dropdown';
import { getThumbnailUrl } from '/@/modules/project';

import { selectCard } from './selectors';
import type { Props } from './types';

import './styles.css';

export function ProjectCard({
  project,
  onClick,
  onDelete,
  onDuplicate,
}: Props) {
  const { parcels } = useSelector(state => selectCard(state, project));

  const handleOnClick = useCallback(() => {
    if (onClick) onClick(project);
  }, [project, onClick]);

  const handleDeleteProject = useCallback(() => {
    onDelete(project);
  }, [project, onDelete]);

  const handleDuplicateProject = useCallback(() => {
    onDuplicate(project);
  }, [project, onDuplicate]);

  const thumbnailUrl = getThumbnailUrl(project);

  const dropdownOptions = [
    {
      text: t('scene_list.project_actions.duplicate_project'),
      handler: handleDuplicateProject,
    },
    {
      text: t('scene_list.project_actions.delete_project'),
      handler: handleDeleteProject,
    },
  ];

  return (
    <div className={cx('ProjectCard', { 'has-thumbnail': !!thumbnailUrl })} onClick={handleOnClick}>
      <div className="project-thumbnail" style={thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})` } : {}} />
      <div className="project-data">
        <div className="title-wrapper">
          <div className="title">{project.title}</div>
          <div className="description" title={project.description}>
            <ViewModuleIcon className="Icon" /> {t('scene_list.parcel_count', { parcels })}
          </div>
        </div>
        <Dropdown className="options-dropdown" options={dropdownOptions} />
      </div>
    </div>
  );
}
