import { useCallback, useMemo, useState } from 'react';
import { Typography, Button, IconButton, Menu, MenuItem } from 'decentraland-ui2';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SettingsIcon from '@mui/icons-material/Settings';

import type { Project } from '/shared/types/projects';
import { SortBy } from '/shared/types/projects';
import { t } from '/@/modules/store/translation/utils';
import { useWorkspace } from '/@/hooks/useWorkspace';
import { useDeploy } from '/@/hooks/useDeploy';
import { addBase64ImagePrefix } from '/@/modules/image';
import { Loader } from '../Loader';
import { PageSearchField } from '../PageSearchField';
import { Projects } from '../SceneList/Projects';
import { DeleteProject } from '../Modals/DeleteProject';
import { DeploymentHistory } from '../Modals/DeploymentHistory';

import layoutGridIcon from '/assets/images/layout-grid.svg';
import layoutListIcon from '/assets/images/layout-list.svg';

import { PaginationBar } from '../Pagination/component';
import { sortProjectsBy } from './utils';

import './styles.css';

const ITEMS_PER_PAGE = 8;
const VIEW_MODE_KEY = 'creator-hub-scenes-view-mode';

type ViewMode = 'grid' | 'list';

function getStoredViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    if (v === 'grid' || v === 'list') return v;
  } catch {
    // ignore
  }
  return 'list';
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '—';
  const now = Date.now();
  const diff = now - timestamp;
  const hour = 60 * 60 * 1000;
  if (diff < hour) return t('scene_list.time.just_now');
  if (diff < hour * 24) {
    const hours = Math.floor(diff / hour);
    return `${hours}h ago`;
  }
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function StatusBadge({ project }: { project: Project }) {
  const { getDeployment } = useDeploy();
  const deployment = getDeployment(project.path);
  const isPublished = !!deployment || project.publishedAt > 0;

  return (
    <span className={`StatusBadge ${isPublished ? 'published' : 'in-progress'}`}>
      {isPublished ? t('scene_list.badges.published') : t('scene_list.badges.in_progress')}
    </span>
  );
}

function SceneRowMenu({ project }: { project: Project }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [openHistoryModal, setOpenHistoryModal] = useState(false);
  const { duplicateProject, deleteProject, openFolder } = useWorkspace();
  const { getDeployment, getDeploymentHistory } = useDeploy();

  const deployment = getDeployment(project.path);
  const history = getDeploymentHistory(project.path);
  const hasDeployments = !!deployment || history.length > 0;

  const handleOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  }, []);
  const handleClose = useCallback(() => setAnchorEl(null), []);

  const handleDuplicate = useCallback(() => {
    duplicateProject(project);
    handleClose();
  }, [project, duplicateProject]);

  const handleOpenFolder = useCallback(() => {
    openFolder(project.path);
    handleClose();
  }, [project]);

  const handleDelete = useCallback(
    (_p: Project, shouldDeleteFiles: boolean) => {
      deleteProject(project, shouldDeleteFiles);
      setOpenDeleteModal(false);
    },
    [project, deleteProject],
  );

  return (
    <>
      <IconButton
        size="small"
        onClick={handleOpen}
      >
        <MoreHorizIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        <MenuItem onClick={handleDuplicate}>
          {t('scene_list.project_actions.duplicate_project')}
        </MenuItem>
        <MenuItem onClick={handleOpenFolder}>
          {t('scene_list.project_actions.open_folder')}
        </MenuItem>
        <MenuItem
          disabled={!hasDeployments}
          onClick={() => {
            setOpenHistoryModal(true);
            handleClose();
          }}
        >
          {t('scene_list.project_actions.view_deployments')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setOpenDeleteModal(true);
            handleClose();
          }}
        >
          {t('scene_list.project_actions.delete_project')}
        </MenuItem>
      </Menu>
      <DeleteProject
        open={openDeleteModal}
        project={project}
        onClose={() => setOpenDeleteModal(false)}
        onSubmit={handleDelete}
      />
      <DeploymentHistory
        open={openHistoryModal}
        projectPath={project.path}
        onClose={() => setOpenHistoryModal(false)}
      />
    </>
  );
}

export function ScenesPage() {
  const {
    isLoading,
    projects,
    sortBy,
    setSortBy,
    runProject,
    getAvailableProject,
    createProject,
    importProject,
  } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>(() => getStoredViewMode());

  const handleSortName = useCallback(() => {
    setSortBy(sortBy === SortBy.NAME ? SortBy.NAME_DESC : SortBy.NAME);
    setCurrentPage(0);
  }, [sortBy, setSortBy]);

  const handleSortModified = useCallback(() => {
    setSortBy(sortBy === SortBy.NEWEST ? SortBy.OLDEST : SortBy.NEWEST);
    setCurrentPage(0);
  }, [sortBy, setSortBy]);

  const handleSortStatus = useCallback(() => {
    setSortBy(
      sortBy === SortBy.STATUS_PUBLISHED_FIRST
        ? SortBy.STATUS_UNPUBLISHED_FIRST
        : SortBy.STATUS_PUBLISHED_FIRST,
    );
    setCurrentPage(0);
  }, [sortBy, setSortBy]);

  const setViewModeAndStore = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const sortedProjects = useMemo(() => sortProjectsBy(projects, sortBy), [projects, sortBy]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return sortedProjects;
    const q = searchQuery.toLowerCase();
    return sortedProjects.filter(p => p.title.toLowerCase().includes(q));
  }, [sortedProjects, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages - 1);

  const paginatedProjects = useMemo(() => {
    const start = safePage * ITEMS_PER_PAGE;
    return filteredProjects.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProjects, safePage]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(0);
  }, []);

  const handleNewScene = useCallback(async () => {
    const [err, data] = await getAvailableProject();
    if (!err && data) {
      const path = data.path.endsWith(data.name)
        ? data.path.slice(0, -data.name.length)
        : data.path;
      createProject({ name: data.name, path });
    }
  }, [getAvailableProject, createProject]);

  const handleRowClick = useCallback(
    (project: Project) => {
      runProject(project);
    },
    [runProject],
  );

  if (isLoading) {
    return (
      <div className="ScenesPage">
        <Loader size={70} />
      </div>
    );
  }

  return (
    <div className="ScenesPage">
      <div className="ScenesHeader">
        <Typography variant="h3">{t('scene_list.my_scenes')}</Typography>
        <div className="ScenesHeaderActions">
          <div
            className="ScenesViewToggle"
            role="group"
            aria-label={t('scene_list.view_mode')}
          >
            <button
              type="button"
              className={`ScenesViewToggleBtn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewModeAndStore('grid')}
              title={t('scene_list.view_grid')}
              aria-pressed={viewMode === 'grid'}
            >
              <img
                src={layoutGridIcon}
                alt=""
                width={20}
                height={20}
              />
            </button>
            <button
              type="button"
              className={`ScenesViewToggleBtn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewModeAndStore('list')}
              title={t('scene_list.view_list')}
              aria-pressed={viewMode === 'list'}
            >
              <img
                src={layoutListIcon}
                alt=""
                width={20}
                height={20}
              />
            </button>
          </div>
          <PageSearchField
            placeholder={t('scene_list.search_placeholder')}
            value={searchQuery}
            onChange={handleSearchChange}
          />
          <Button
            className="ImportSceneButton"
            variant="outlined"
            color="secondary"
            size="small"
            startIcon={<FolderOpenIcon />}
            onClick={importProject}
          >
            {t('scene_list.import_scene')}
          </Button>
          <Button
            className="NewSceneButton"
            variant="contained"
            color="primary"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleNewScene}
          >
            {t('scene_list.new_scene')}
          </Button>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="ScenesEmpty">
          <Typography variant="h5">{t('scene_list.no_scenes.title')}</Typography>
          <Typography
            variant="body2"
            sx={{ color: 'rgba(255,255,255,0.7)' }}
          >
            {searchQuery ? t('scene_list.no_results') : t('scene_list.no_scenes.subtitle')}
          </Typography>
          {!searchQuery && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleNewScene}
            >
              {t('scene_list.new_scene')}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="ScenesContent">
            {viewMode === 'grid' ? (
              <Projects
                projects={paginatedProjects}
                showNewSceneCard={false}
                cardAutoHeight
              />
            ) : (
              <div className="ScenesTable">
                <div className="ScenesTableHead">
                  <div className="ScenesTableCell cell-thumbnail">
                    {t('scene_list.table.thumbnail')}
                  </div>
                  <button
                    type="button"
                    className="ScenesTableCell ScenesTableHeadSort cell-name"
                    onClick={handleSortName}
                  >
                    {t('scene_list.table.name')}
                  </button>
                  <button
                    type="button"
                    className="ScenesTableCell ScenesTableHeadSort cell-modified"
                    onClick={handleSortModified}
                  >
                    {t('scene_list.table.modified')}
                  </button>
                  <button
                    type="button"
                    className="ScenesTableCell ScenesTableHeadSort cell-status"
                    onClick={handleSortStatus}
                  >
                    {t('scene_list.table.status')}
                  </button>
                  <div className="ScenesTableCell cell-actions">
                    <SettingsIcon sx={{ fontSize: 18, opacity: 0.7 }} />
                  </div>
                </div>
                {paginatedProjects.map(project => {
                  const thumbnailUrl = project.thumbnail
                    ? addBase64ImagePrefix(project.thumbnail)
                    : undefined;
                  return (
                    <div
                      key={project.id}
                      className="ScenesTableRow"
                      onClick={() => handleRowClick(project)}
                    >
                      <div className="ScenesTableCell cell-thumbnail">
                        {thumbnailUrl ? (
                          <img
                            className="SceneThumbnail"
                            src={thumbnailUrl}
                            alt={project.title}
                          />
                        ) : (
                          <div className="SceneThumbnailPlaceholder" />
                        )}
                      </div>
                      <div className="ScenesTableCell cell-name">
                        <div className="SceneName">
                          <Typography
                            variant="body1"
                            fontWeight={500}
                          >
                            {project.title}
                          </Typography>
                          <Typography
                            className="ScenePath"
                            variant="caption"
                          >
                            {project.path}
                          </Typography>
                        </div>
                      </div>
                      <div className="ScenesTableCell cell-modified">
                        <Typography
                          variant="body2"
                          sx={{ color: 'rgba(255,255,255,0.7)' }}
                        >
                          {formatDate(project.updatedAt)}
                        </Typography>
                      </div>
                      <div className="ScenesTableCell cell-status">
                        <StatusBadge project={project} />
                      </div>
                      <div className="ScenesTableCell cell-actions">
                        <SceneRowMenu project={project} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <PaginationBar
            page={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            className="ScenesPaginationBar"
          />
        </>
      )}
    </div>
  );
}
