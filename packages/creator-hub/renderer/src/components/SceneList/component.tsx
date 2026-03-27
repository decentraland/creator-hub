import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, Menu, MenuItem, type SelectChangeEvent, Typography } from 'decentraland-ui2';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

import type { Project } from '/shared/types/projects';
import { SortBy } from '/shared/types/projects';
import { t } from '/@/modules/store/translation/utils';
import { useWorkspace } from '/@/hooks/useWorkspace';
import { useDeploy } from '/@/hooks/useDeploy';
import { addBase64ImagePrefix } from '/@/modules/image';

import { Button } from '../Button';
import { Column } from '../Column';
import { FiltersBar } from '../FiltersBar';
import { Row } from '../Row';
import { Search } from '../Search';
import { Select } from '../Select';
import { DeleteProject } from '../Modals/DeleteProject';
import { DeploymentHistory } from '../Modals/DeploymentHistory';
import { Projects } from './Projects';
import type { Props } from './types';

import layoutGridIcon from '/assets/images/layout-grid.svg';
import layoutListIcon from '/assets/images/layout-list.svg';

import './styles.css';

// ─── View mode ───────────────────────────────────────────────────────────────

const VIEW_MODE_KEY = 'creator-hub-scenes-view-mode';
type ViewMode = 'grid' | 'list';

function getStoredViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    if (v === 'grid' || v === 'list') return v;
  } catch {
    // ignore
  }
  return 'grid';
}

// ─── List view helpers ────────────────────────────────────────────────────────

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
  }, [project, duplicateProject, handleClose]);

  const handleOpenFolder = useCallback(() => {
    openFolder(project.path);
    handleClose();
  }, [project, openFolder, handleClose]);

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

// ─── Main component ───────────────────────────────────────────────────────────

export function SceneList({ projects, sortBy, onSort }: Props) {
  const { importProject, runProject } = useWorkspace();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(() => getStoredViewMode());

  const filteredProjects = searchQuery
    ? projects.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : projects;

  const setViewModeAndStore = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const sort = useCallback(
    (_sortBy: SortBy) => {
      onSort(_sortBy);
    },
    [sortBy, onSort],
  );

  const handleDropdownChange = useCallback(
    (e: SelectChangeEvent<SortBy>) => {
      sort(e.target.value as SortBy);
    },
    [sort],
  );

  const handleRowClick = useCallback(
    (project: Project) => {
      runProject(project);
    },
    [runProject],
  );

  const renderSortDropdown = () => {
    return (
      <Select
        variant="standard"
        value={sortBy}
        onChange={handleDropdownChange}
      >
        <MenuItem
          className="sort-item"
          value={SortBy.NEWEST}
        >
          {t('scene_list.sort.newest')}
        </MenuItem>
        <MenuItem
          className="sort-item"
          value={SortBy.NAME}
        >
          {t('scene_list.sort.name')}
        </MenuItem>
        <MenuItem
          className="sort-item"
          value={SortBy.SIZE}
        >
          {t('scene_list.sort.size')}
        </MenuItem>
      </Select>
    );
  };

  return (
    <div className="SceneList">
      <Column className="projects-menu">
        <Row>
          <Typography variant="h3">{t('scene_list.my_scenes')}</Typography>
          <Row className="actions">
            <Button
              className="action-button import-button"
              startIcon={<i className="icon import-icon" />}
              color="secondary"
              onClick={importProject}
            >
              {t('scene_list.import_scene')}
            </Button>
            <Button
              className="action-button templates-button"
              startIcon={<i className="icon template-icon" />}
              color="primary"
              onClick={() => navigate('/templates')}
            >
              {t('scene_list.templates')}
            </Button>
          </Row>
        </Row>
        {projects.length > 0 ? (
          <FiltersBar>
            <Typography variant="h6">
              {t('scene_list.results', { count: filteredProjects.length })}
            </Typography>
            <>
              <div
                className="SceneViewToggle"
                role="group"
                aria-label={t('scene_list.view_mode')}
              >
                <button
                  type="button"
                  className={`SceneViewToggleBtn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewModeAndStore('grid')}
                  title={t('scene_list.view_grid')}
                  aria-pressed={viewMode === 'grid'}
                >
                  <img
                    src={layoutGridIcon}
                    alt=""
                    width={18}
                    height={18}
                  />
                </button>
                <button
                  type="button"
                  className={`SceneViewToggleBtn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewModeAndStore('list')}
                  title={t('scene_list.view_list')}
                  aria-pressed={viewMode === 'list'}
                >
                  <img
                    src={layoutListIcon}
                    alt=""
                    width={18}
                    height={18}
                  />
                </button>
              </div>
              <p>{t('scene_list.sort_by')}</p>
              {renderSortDropdown()}
              <Search
                placeholder={t('scene_list.search')}
                onChange={setSearchQuery}
              />
            </>
          </FiltersBar>
        ) : null}
      </Column>
      {viewMode === 'grid' ? (
        <div className="list">
          <Projects projects={filteredProjects} />
        </div>
      ) : (
        <div className="SceneListTable">
          <div className="SceneListTableHead">
            <div className="SceneListTableCell cell-thumbnail">
              {t('scene_list.table.thumbnail')}
            </div>
            <div className="SceneListTableCell cell-name">{t('scene_list.table.name')}</div>
            <div className="SceneListTableCell cell-parcels">{t('scene_list.table.parcels')}</div>
            <div className="SceneListTableCell cell-modified">{t('scene_list.table.modified')}</div>
            <div className="SceneListTableCell cell-actions" />
          </div>
          {filteredProjects.map(project => {
            const thumbnailUrl = project.thumbnail
              ? addBase64ImagePrefix(project.thumbnail)
              : undefined;
            return (
              <div
                key={project.id}
                className="SceneListTableRow"
                onClick={() => handleRowClick(project)}
              >
                <div className="SceneListTableCell cell-thumbnail">
                  {thumbnailUrl ? (
                    <img
                      className="SceneListThumbnail"
                      src={thumbnailUrl}
                      alt={project.title}
                    />
                  ) : (
                    <div className="SceneListThumbnailPlaceholder" />
                  )}
                </div>
                <div className="SceneListTableCell cell-name">
                  <div className="SceneListName">
                    <Typography
                      variant="body1"
                      fontWeight={500}
                    >
                      {project.title}
                    </Typography>
                    <Typography
                      className="SceneListPath"
                      variant="caption"
                    >
                      {project.path}
                    </Typography>
                  </div>
                </div>
                <div className="SceneListTableCell cell-parcels">
                  <Typography
                    variant="body2"
                    sx={{ color: 'rgba(255,255,255,0.7)' }}
                  >
                    {project.layout.cols * project.layout.rows}
                  </Typography>
                </div>
                <div className="SceneListTableCell cell-modified">
                  <Typography
                    variant="body2"
                    sx={{ color: 'rgba(255,255,255,0.7)' }}
                  >
                    {formatDate(project.updatedAt)}
                  </Typography>
                </div>
                <div className="SceneListTableCell cell-actions">
                  <SceneRowMenu project={project} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
