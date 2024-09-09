import { useCallback } from 'react';
import { MenuItem, type SelectChangeEvent, Box, Typography } from 'decentraland-ui2';
import { useNavigate } from 'react-router-dom';

import { SortBy } from '/shared/types/projects';
import { t } from '/@/modules/store/translation/utils';
import { useWorkspace } from '/@/hooks/useWorkspace';

import type { Props } from './types';

import { Button } from '../Button';
import { Column } from '../Column';
import { FiltersBar } from '../FiltersBar';
import { Projects } from './Projects';
import { Row } from '../Row';
import { Select } from '../Select';

import './styles.css';

export function SceneList({ projects, sortBy, onSort }: Props) {
  const { importProject } = useWorkspace();
  const navigate = useNavigate();

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
          <Typography variant="h4">{t('scene_list.my_scenes')}</Typography>
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
            <>{t('scene_list.results', { count: projects.length })}</>
            <>
              <p>{t('scene_list.sort_by')}</p>
              {renderSortDropdown()}
            </>
          </FiltersBar>
        ) : null}
      </Column>
      <Box
        display="grid"
        gridTemplateColumns={`repeat(${projects.length > 0 ? 4 : 1}, 1fr)`}
        gap={2}
      >
        <Projects projects={projects} />
      </Box>
    </div>
  );
}
