// REMOVE
/* eslint-disable @typescript-eslint/no-unused-vars */
import {useCallback, useEffect, useState, type CSSProperties} from 'react';

import {useSelector} from '../../modules/store';
import {t} from '../../dapps-v2/translation/utils';

import {Icon} from '../Icon';
import {OptionsDropdown} from '../OptionsDropdown';
import {getThumbnailUrl} from '../../modules/project';

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
    if (onClick) {
      onClick(project);
    }
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

  let style: CSSProperties = {};
  let classes = 'ProjectCard';

  const thumbnailUrl = getThumbnailUrl(project);
  if (thumbnailUrl) {
    style = {backgroundImage: `url(${thumbnailUrl})`};
    classes += ' has-thumbnail';
  }

  const dropdownOptions = [
    {
      text: t('scenes_page.project_actions.duplicate_project'),
      handler: handleDuplicateProject,
    },
    {
      text: t('scenes_page.project_actions.export_project'),
      handler: handleExportScene,
    },
    {
      text: t('scenes_page.project_actions.delete_project'),
      handler: handleConfirmDeleteProject,
    },
  ];

  const children = (
    <>
      <div
        className="project-thumbnail"
        style={style}
      />
      <>
        <div className="options-container">
          <OptionsDropdown
            className="options-dropdown"
            options={dropdownOptions}
          />
        </div>
      </>
      <div className="project-data">
        <div className="title-wrapper">
          <div className="title">{project.title}</div>
        </div>
        <div
          className="description"
          title={project.description}
        >
          <Icon name="scene-parcel" /> {t('scenes_page.parcel_count', {parcels})}
        </div>
      </div>
    </>
  );

  return (
    <>
      <div
        className={classes}
        onClick={handleOnClick}
      >
        {children}
      </div>
    </>
  );
}
