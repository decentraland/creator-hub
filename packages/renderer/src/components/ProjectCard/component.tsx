import { useCallback, useState } from 'react';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import cx from 'classnames';

import { addBase64ImagePrefix } from '/@/modules/image';
import { t } from '/@/modules/store/translation/utils';

import { Dropdown } from '../Dropdown';
import { DeleteProject } from '../Modals/DeleteProject';

import type { Props } from './types';

import './styles.css';
import { useWorkspace } from '/@/hooks/useWorkspace';

export function ProjectCard({ project }: Props) {
  const [open, setOpen] = useState(false);
  const parcels = project.layout.cols * project.layout.rows;

  const { selectProject, duplicateProject, deleteProject, openFolder } = useWorkspace();

  const handleClick = useCallback(() => {
    selectProject(project);
  }, [project, selectProject]);

  const handleDuplicateProject = useCallback(() => {
    duplicateProject(project);
  }, [project, duplicateProject]);

  const handleDeleteProject = useCallback(() => {
    deleteProject(project);
    handleCloseModal();
  }, [project, deleteProject]);

  const handleOpenFolder = useCallback(() => {
    openFolder(project.path);
  }, [project, openFolder]);

  const handleOpenModal = useCallback(() => {
    setOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setOpen(false);
  }, []);

  const thumbnailUrl = project.thumbnail ? addBase64ImagePrefix(project.thumbnail) : undefined;

  const dropdownOptions = [
    {
      text: t('scene_list.project_actions.duplicate_project'),
      handler: handleDuplicateProject,
    },
    {
      text: t('scene_list.project_actions.open_folder'),
      handler: handleOpenFolder,
    },
    {
      text: t('scene_list.project_actions.delete_project'),
      handler: handleOpenModal,
    },
  ];

  return (
    <>
      <div
        className={cx('ProjectCard', { 'has-thumbnail': !!thumbnailUrl })}
        onClick={handleClick}
      >
        <div
          className="project-thumbnail"
          style={thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})` } : {}}
        />
        <div className="project-data">
          <div className="title-wrapper">
            <div className="title">{project.title}</div>
            <div
              className="description"
              title={project.description}
            >
              <ViewModuleIcon className="Icon" /> {t('scene_list.parcel_count', { parcels })}
            </div>
          </div>
          <Dropdown
            className="options-dropdown"
            options={dropdownOptions}
          />
        </div>
      </div>
      <DeleteProject
        open={open}
        project={project}
        onClose={handleCloseModal}
        onSubmit={handleDeleteProject}
      />
    </>
  );
}
