import { useCallback } from 'react';
import { Select, MenuItem, type SelectChangeEvent, Box, Typography } from 'decentraland-ui2';
import AddIcon from '@mui/icons-material/Add';

import { SortBy } from '/shared/types/projects';
import { t } from '/@/modules/store/translation/utils';
import { ProjectCard } from '/@/components/ProjectCard';
import { useWorkspace } from '/@/hooks/useWorkspace';

import type { Props } from './types';

import { Button } from '../Button';
import { Column } from '../Column';
import { Row } from '../Row';
import { OpenFolder } from '../Icons';

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
  const { importProject, createProject } = useWorkspace();

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
        className="sort-dropdown"
        variant="standard"
        value={sortBy}
        onChange={handleDropdownChange}
        MenuProps={{
          className: 'SceneListSortMenu',
        }}
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

  const renderProjects = () => {
    if (projects.length > 0) {
      return projects.map(project => (
        <ProjectCard
          key={project.path}
          project={project}
        />
      ));
    }

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
          <div className="no-scenes-card-button"></div>
        </div>
      </div>
    );
  };

  return (
    <div className="SceneList">
      <Column className="projects-menu">
        <Row>
          <Typography variant="h4">{t('scene_list.my_scenes')}</Typography>
          <Row className="actions">
            <Button
              startIcon={<OpenFolder />}
              color="secondary"
              onClick={importProject}
            >
              {t('scene_list.import_scene')}
            </Button>
            <Button
              startIcon={<AddIcon />}
              color="primary"
              onClick={createProject}
            >
              {t('scene_list.create_scene')}
            </Button>
          </Row>
        </Row>
        {projects.length > 0 ? (
          <Row className="filters">
            <Row className="items-count">{t('scene_list.results', { count: projects.length })}</Row>
            <Row className="sort-by">
              <p>{t('scene_list.sort_by')}</p>&nbsp;{renderSortDropdown()}
            </Row>
          </Row>
        ) : null}
      </Column>
      <Box
        display="grid"
        gridTemplateColumns={`repeat(${projects.length > 0 ? 4 : 1}, 1fr)`}
        gap={2}
      >
        <div className="new-scene"></div>
        {renderProjects()}
      </Box>
    </div>
  );
}
