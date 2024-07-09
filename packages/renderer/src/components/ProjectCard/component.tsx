// REMOVE
/* eslint-disable @typescript-eslint/no-unused-vars */
import {useCallback, useEffect, useState, type CSSProperties} from 'react';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import cx from 'classnames';

import {useSelector} from '/@/modules/store';
import { t } from '/@/modules/store/reducers/translation/utils';

import {OptionsDropdown} from '/@/components/OptionsDropdown';
import {getThumbnailUrl} from '/@/modules/project';

import {selectCard} from './selectors';
import type {Props} from './types';

import './styles.css';

export function ProjectCard({
  project,
  onClick,
  onDeleteProject,
  onDuplicateProject,
  onOpenModal,
  onLoadProjectScene,
}: Props) {
  const {parcels} = useSelector(state => selectCard(state, project));
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    onLoadProjectScene(project);
  });

  const handleOnClick = useCallback(() => {
    if (onClick) onClick(project);
  }, [project, onClick]);

  const handleConfirmDeleteProject = useCallback(() => {
    setIsDeleting(true);
  }, []);

  const handleCancelDeleteProject = useCallback(() => {
    setIsDeleting(false);
  }, []);

  const handleDeleteProject = useCallback(() => {
    onDeleteProject(project);
    setIsDeleting(false);
  }, [project, onDeleteProject]);

  const handleDuplicateProject = useCallback(() => {
    onDuplicateProject(project);
  }, [project, onDuplicateProject]);

  const handleExportScene = useCallback(() => {
    onOpenModal('ExportModal', {project});
  }, [project, onOpenModal]);


  const thumbnailUrl = getThumbnailUrl(project);

  const dropdownOptions = [
    {
      text: t('scene_list.project_actions.duplicate_project'),
      handler: handleDuplicateProject,
    },
    {
      text: t('scene_list.project_actions.delete_project'),
      handler: handleConfirmDeleteProject,
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
        <OptionsDropdown className="options-dropdown" options={dropdownOptions} />
      </div>
    </div>
  );
}
