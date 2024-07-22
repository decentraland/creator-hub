import { useCallback, useState } from 'react';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import cx from 'classnames';
import { Link } from 'react-router-dom';

import { getThumbnailUrl } from '/@/modules/project';
import { t } from '/@/modules/store/translation/utils';

import { Dropdown } from '../Dropdown';
import { DeleteProject } from '../Modals/DeleteProject';

import type { Props } from './types';

import './styles.css';

export function ProjectCard({ project, onDelete, onDuplicate }: Props) {
  const [open, setOpen] = useState(false);
  const parcels = project.layout.cols * project.layout.rows;

  const handleDeleteProject = useCallback(() => {
    onDelete(project);
  }, [project, onDelete]);

  const handleDuplicateProject = useCallback(() => {
    onDuplicate(project);
  }, [project, onDuplicate]);

  const handleOpenModal = useCallback(() => {
    setOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setOpen(false);
  }, []);

  const thumbnailUrl = getThumbnailUrl(project);

  const dropdownOptions = [
    {
      text: t('scene_list.project_actions.duplicate_project'),
      handler: handleDuplicateProject,
    },
    {
      text: t('scene_list.project_actions.delete_project'),
      handler: handleOpenModal,
    },
  ];

  return (
    <div className={cx('ProjectCard', { 'has-thumbnail': !!thumbnailUrl })}>
      <Link
        to={`/editor?path=${encodeURIComponent(project.path)}`}
        className="project-thumbnail"
        style={thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})` } : {}}
      />
      <div className="project-data">
        <Link
          to={`/editor?path=${encodeURIComponent(project.path)}`}
          className="title-wrapper"
        >
          <div className="title">{project.title}</div>
          <div
            className="description"
            title={project.description}
          >
            <ViewModuleIcon className="Icon" /> {t('scene_list.parcel_count', { parcels })}
          </div>
        </Link>
        <Dropdown
          className="options-dropdown"
          options={dropdownOptions}
        />
      </div>
      <DeleteProject
        open={open}
        project={project}
        onClose={handleCloseModal}
        onSubmit={handleDeleteProject}
      />
    </div>
  );
}
