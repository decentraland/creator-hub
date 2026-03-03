import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography } from 'decentraland-ui2';

import type { Project } from '/shared/types/projects';
import { misc } from '#preload';

import { t } from '/@/modules/store/translation/utils';
import { useDeploy } from '/@/hooks/useDeploy';
import { useWorkspace } from '/@/hooks/useWorkspace';
import { addBase64ImagePrefix } from '/@/modules/image';
import type { Option } from '/@/components/Dropdown/types';

import { DeleteProject } from '../../Modals/DeleteProject';
import { DeploymentHistory } from '../../Modals/DeploymentHistory';
import { ProjectCard } from '../../ProjectCard';

import type { Props } from './types';

type ModalState = { delete: boolean; history: boolean };

export function Projects({ projects, showNewSceneCard = true, cardAutoHeight = false }: Props) {
  const navigate = useNavigate();
  const [openModals, setOpenModals] = useState<Record<string, ModalState>>({});

  if (!projects.length && !showNewSceneCard) return null;
  if (!projects.length) return <NoScenes />;

  const getModal = (path: string) => openModals[path] ?? { delete: false, history: false };

  /* When cardAutoHeight (Scenes grid), render grid with only cards so gap works; modals live outside grid. */
  if (cardAutoHeight) {
    return (
      <>
        <div className="ScenesGrid">
          {projects.map(project => (
            <ProjectCardOnly
              key={project.path}
              project={project}
              onOpenDelete={() =>
                setOpenModals(prev => ({
                  ...prev,
                  [project.path]: { ...getModal(project.path), delete: true },
                }))
              }
              onOpenHistory={() =>
                setOpenModals(prev => ({
                  ...prev,
                  [project.path]: { ...getModal(project.path), history: true },
                }))
              }
            />
          ))}
        </div>
        {projects.map(project => (
          <ProjectModals
            key={project.path}
            project={project}
            openDelete={getModal(project.path).delete}
            openHistory={getModal(project.path).history}
            onCloseDelete={() =>
              setOpenModals(prev => ({
                ...prev,
                [project.path]: { ...getModal(project.path), delete: false },
              }))
            }
            onCloseHistory={() =>
              setOpenModals(prev => ({
                ...prev,
                [project.path]: { ...getModal(project.path), history: false },
              }))
            }
          />
        ))}
      </>
    );
  }

  return (
    <>
      {showNewSceneCard && (
        <div
          className="new-scene"
          onClick={() => navigate('/templates')}
        ></div>
      )}
      {projects.map(project => (
        <Project
          key={project.path}
          project={project}
          cardAutoHeight={false}
        />
      ))}
    </>
  );
}

function ProjectCardOnly({
  project,
  onOpenDelete,
  onOpenHistory,
}: {
  project: Project;
  onOpenDelete: () => void;
  onOpenHistory: () => void;
}) {
  const { getDeployment, getDeploymentHistory } = useDeploy();
  const { runProject, duplicateProject, deleteProject, openFolder } = useWorkspace();
  const deployment = getDeployment(project.path);
  const history = getDeploymentHistory(project.path);
  const hasDeployments = !!deployment || history.length > 0;
  const parcels = project.layout.cols * project.layout.rows;

  const handleClick = useCallback(() => runProject(project), [project, runProject]);
  const handleDuplicateProject = useCallback(
    () => duplicateProject(project),
    [project, duplicateProject],
  );
  const handleOpenFolder = useCallback(() => openFolder(project.path), [project, openFolder]);

  const dropdownOptions = useMemo(() => {
    const options: Option[] = [
      { text: t('scene_list.project_actions.duplicate_project'), handler: handleDuplicateProject },
      { text: t('scene_list.project_actions.open_folder'), handler: handleOpenFolder },
    ];
    options.push({
      text: t('scene_list.project_actions.view_deployments'),
      handler: onOpenHistory,
      disabled: !hasDeployments,
    });
    options.push({
      text: t('scene_list.project_actions.delete_project'),
      handler: onOpenDelete,
    });
    return options;
  }, [hasDeployments, handleDuplicateProject, handleOpenFolder, onOpenDelete, onOpenHistory]);

  const thumbnailUrl = project.thumbnail ? addBase64ImagePrefix(project.thumbnail) : undefined;
  const isPublished = !!deployment || project.publishedAt > 0;
  const content = (
    <>
      <span className="SceneCardParcelRow">
        <i className="icon" /> {t('scene_list.parcel_count', { parcels })}
      </span>
      <span className={`SceneCardStatusChip ${isPublished ? 'published' : 'in-progress'}`}>
        {isPublished ? t('scene_list.badges.published') : t('scene_list.badges.in_progress')}
      </span>
    </>
  );
  const publishedAt =
    deployment?.status === 'complete' ? deployment?.lastUpdated : project.publishedAt;

  return (
    <ProjectCard
      title={project.title}
      imageUrl={thumbnailUrl}
      dropdownOptions={dropdownOptions}
      content={content}
      publishedAt={publishedAt ?? 0}
      status={project.status}
      onClick={handleClick}
      autoHeight
    />
  );
}

function ProjectModals({
  project,
  openDelete,
  openHistory,
  onCloseDelete,
  onCloseHistory,
}: {
  project: Project;
  openDelete: boolean;
  openHistory: boolean;
  onCloseDelete: () => void;
  onCloseHistory: () => void;
}) {
  const { deleteProject } = useWorkspace();

  const handleDeleteProject = useCallback(
    (_p: Project, shouldDeleteFiles: boolean) => {
      deleteProject(project, shouldDeleteFiles);
      onCloseDelete();
    },
    [project, deleteProject, onCloseDelete],
  );

  return (
    <>
      <DeleteProject
        open={openDelete}
        project={project}
        onClose={onCloseDelete}
        onSubmit={handleDeleteProject}
      />
      <DeploymentHistory
        open={openHistory}
        projectPath={project.path}
        onClose={onCloseHistory}
      />
    </>
  );
}

function Project({ project, cardAutoHeight }: { project: Project; cardAutoHeight: boolean }) {
  const { getDeployment, getDeploymentHistory } = useDeploy();
  const { runProject, duplicateProject, deleteProject, openFolder } = useWorkspace();
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [openHistoryModal, setOpenHistoryModal] = useState(false);

  const deployment = getDeployment(project.path);
  const history = getDeploymentHistory(project.path);
  const hasDeployments = !!deployment || history.length > 0;
  const parcels = project.layout.cols * project.layout.rows;

  const handleClick = useCallback(() => {
    runProject(project);
  }, [project, runProject]);

  const handleDuplicateProject = useCallback(() => {
    duplicateProject(project);
  }, [project, duplicateProject]);

  const handleOpenFolder = useCallback(() => {
    openFolder(project.path);
  }, [project, openFolder]);

  const handleOpenDeleteModal = useCallback(() => {
    setOpenDeleteModal(true);
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    setOpenDeleteModal(false);
  }, []);

  const handleOpenHistoryModal = useCallback(() => {
    setOpenHistoryModal(true);
  }, []);

  const handleCloseHistoryModal = useCallback(() => {
    setOpenHistoryModal(false);
  }, []);

  const handleDeleteProject = useCallback(
    (_p: Project, shouldDeleteFiles: boolean) => {
      deleteProject(project, shouldDeleteFiles);
      handleCloseDeleteModal();
    },
    [project, deleteProject, handleCloseDeleteModal],
  );

  const dropdownOptions = useMemo(() => {
    const options: Option[] = [
      {
        text: t('scene_list.project_actions.duplicate_project'),
        handler: handleDuplicateProject,
      },
      {
        text: t('scene_list.project_actions.open_folder'),
        handler: handleOpenFolder,
      },
    ];

    options.push({
      text: t('scene_list.project_actions.view_deployments'),
      handler: handleOpenHistoryModal,
      disabled: !hasDeployments,
    });

    options.push({
      text: t('scene_list.project_actions.delete_project'),
      handler: handleOpenDeleteModal,
    });

    return options;
  }, [
    hasDeployments,
    handleDuplicateProject,
    handleOpenFolder,
    handleOpenHistoryModal,
    handleOpenDeleteModal,
  ]);

  const thumbnailUrl = project.thumbnail ? addBase64ImagePrefix(project.thumbnail) : undefined;
  const isPublished = !!deployment || project.publishedAt > 0;
  const content = (
    <>
      <span className="SceneCardParcelRow">
        <i className="icon" /> {t('scene_list.parcel_count', { parcels })}
      </span>
      <span className={`SceneCardStatusChip ${isPublished ? 'published' : 'in-progress'}`}>
        {isPublished ? t('scene_list.badges.published') : t('scene_list.badges.in_progress')}
      </span>
    </>
  );

  const publishedAt = useMemo(() => {
    if (deployment?.status === 'complete') return deployment?.lastUpdated;
    return project.publishedAt;
  }, [deployment, project.publishedAt]);

  return (
    <>
      <ProjectCard
        title={project.title}
        imageUrl={thumbnailUrl}
        dropdownOptions={dropdownOptions}
        content={content}
        publishedAt={publishedAt}
        status={project.status}
        onClick={handleClick}
        autoHeight={cardAutoHeight}
      />
      <DeleteProject
        open={openDeleteModal}
        project={project}
        onClose={handleCloseDeleteModal}
        onSubmit={handleDeleteProject}
      />
      <DeploymentHistory
        open={openHistoryModal}
        projectPath={project.path}
        onClose={handleCloseHistoryModal}
      />
    </>
  );
}

function NoScenesAnchor(content: string) {
  const handleClick = useCallback(
    () =>
      misc.openExternal(
        'https://docs.decentraland.org/creator/scenes-sdk7/getting-started/sdk-101',
      ),
    [],
  );

  return (
    <a
      rel="noreferrer"
      target="_blank"
      href="https://docs.decentraland.org/creator/scenes-sdk7/getting-started/sdk-101"
      onClick={handleClick}
    >
      {content}
    </a>
  );
}

function NoScenes() {
  const navigate = useNavigate();

  return (
    <div className="no-scenes-container">
      <div className="no-scenes-card">
        <div className="no-scenes-card-text">
          <Typography
            variant="h3"
            className="no-scenes-title"
          >
            {t('scene_list.no_scenes.title')}
          </Typography>
          <span className="no-scenes-description">
            {t('scene_list.no_scenes.description', { a: NoScenesAnchor })}
          </span>
        </div>
        <div
          className="no-scenes-card-button"
          onClick={() => navigate('/templates')}
        ></div>
      </div>
    </div>
  );
}
