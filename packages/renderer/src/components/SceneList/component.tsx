import { useCallback } from 'react';
import { Select, MenuItem, type SelectChangeEvent, Box } from 'decentraland-ui2';

import { useDispatch } from '#store';
import { type Project, SortBy } from '/shared/types/projects';
import { t } from '/@/modules/store/reducers/translation/utils';
import { SceneCreationSelector } from '/@/components/SceneCreationSelector';
import { ProjectCard } from '/@/components/ProjectCard';
import {
  createProject,
  deleteProject,
  duplicateProject,
  importProject,
} from '/@/modules/store/reducers/workspace/thunks';

import type { Props } from './types';

import { Button } from '../Button';
import { Column } from '../Column';
import { Row } from '../Row';
import { OpenFolder, Plus } from '../Icons';

import './styles.css';

function NoScenesAnchor(content: string) {
  return (
    <a
      rel="noreferrer"
      target="_blank"
      href="https://docs.decentraland.org/creator/development-guide/sdk-101/"
    >
      {content}
    </a>
  );
}

export function SceneList({ projects, sortBy, onSort }: Props) {
  const dispatch = useDispatch();

  const handleDelete = useCallback((project: Project) => {
    dispatch(deleteProject(project.path));
  }, []);

  const handleDuplicate = useCallback((project: Project) => {
    dispatch(duplicateProject(project.path));
  }, []);

  const handleImportProject = useCallback(() => {
    dispatch(importProject());
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    dispatch(createProject('Placeholder'));
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

  const renderSortDropdown = () => {
    return (
      <Select
        variant="standard"
        value={sortBy}
        onChange={handleDropdownChange}
      >
        <MenuItem value={SortBy.NEWEST}>{t('scene_list.sort.newest')}</MenuItem>
        <MenuItem value={SortBy.NAME}>{t('scene_list.sort.name')}</MenuItem>
        <MenuItem value={SortBy.SIZE}>{t('scene_list.sort.size')}</MenuItem>
      </Select>
    );
  };

  const renderProjects = () => {
    if (projects.length > 0) {
      return projects.map(project => (
        <ProjectCard
          key={project.path}
          project={project}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      ));
    }

    return (
      <div className="no-scenes-container">
        <h3 className="no-scenes-title">{t('scene_list.no_scenes.title')}</h3>
        <span className="no-scenes-description">
          {t('scene_list.no_scenes.description', { a: NoScenesAnchor })}
        </span>
        <SceneCreationSelector onOpenModal={handleOpenCreateModal} />
      </div>
    );
  };

  return (
    <div className="SceneList">
      <Column className="projects-menu">
        <Row>
          <h4>{t('scene_list.my_scenes')}</h4>
          <Row className="actions">
            <Button
              startIcon={<OpenFolder />}
              color="secondary"
              onClick={handleImportProject}
            >
              {t('scene_list.import_scene')}
            </Button>
            <Button
              startIcon={<Plus />}
              color="primary"
              onClick={handleOpenCreateModal}
            >
              {t('scene_list.create_scene')}
            </Button>
          </Row>
        </Row>
        <Row className="actions">
          <Row className="items-count">{t('scene_list.results', { count: projects.length })}</Row>
          <Row>{projects.length > 1 ? renderSortDropdown() : null}</Row>
        </Row>
      </Column>
      <Box
        display="grid"
        gridTemplateColumns={`repeat(${projects.length > 0 ? 4 : 1}, 1fr)`}
        gap={2}
      >
        {renderProjects()}
      </Box>
    </div>
  );
}
