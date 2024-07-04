import {useCallback} from 'react';
import classNames from 'classnames';
import {Container, Button, Select, MenuItem, type SelectChangeEvent} from 'decentraland-ui2';

import {t} from '../../dapps-v2/translation/utils';

import {SceneCreationSelector} from '../SceneCreationSelector';
import {ProjectCard} from '../ProjectCard';

import type {Props} from './types';
import {SortBy} from './types';

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

export function ScenesPage({projects, sortBy, onOpenModal, onSort}: Props) {
  const handleOpenImportModal = useCallback(() => {
    onOpenModal('ImportModal');
  }, [onOpenModal]);

  const handleOpenCreateModal = useCallback(() => {
    onOpenModal('SceneCreationModal');
  }, [onOpenModal]);

  const renderImportButton = () => {
    return (
      <Button
        className="import-scene"
        onClick={handleOpenImportModal}
      >
        {t('scenes_page.upload_scene')}
      </Button>
    );
  };

  const renderCreateButton = () => {
    return (
      <Button
        className="create-scene"
        onClick={handleOpenCreateModal}
      >
        {t('scenes_page.create_scene')}
      </Button>
    );
  };

  const sort = useCallback(
    (_sortBy: SortBy) => {
      onSort(_sortBy);
    },
    [sortBy, onSort],
  );

  const handleDropdownChange = useCallback(
    (e: SelectChangeEvent<SortBy>) => sort(e.target.value as SortBy),
    [sort],
  );

  const renderSortDropdown = () => {
    return (
      <Select
        value={sortBy}
        onChange={handleDropdownChange}
      >
        <MenuItem value={SortBy.NEWEST}>{t('scenes_page.sort.newest')}</MenuItem>
        <MenuItem value={SortBy.NAME}>{t('scenes_page.sort.name')}</MenuItem>
        <MenuItem value={SortBy.SIZE}>{t('scenes_page.sort.size')}</MenuItem>
      </Select>
    );
  };

  const noop = () => undefined;

  const renderProjects = () => {
    if (projects.length > 0) {
      return (
        <div className="CardList">
          {projects.map(project => (
            <ProjectCard
              key={project.path}
              project={project}
              onDeleteProject={noop}
              onDuplicateProject={noop}
              onOpenModal={noop}
              onLoadProjectScene={noop}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="no-scenes-container">
        <h3 className="no-scenes-title">{t('scenes_page.no_scenes.title')}</h3>
        <span className="no-scenes-description">
          {t('scenes_page.no_scenes.description', {a: NoScenesAnchor})}
        </span>
        <SceneCreationSelector onOpenModal={handleOpenCreateModal} />
      </div>
    );
  };

  return (
    <div className="ScenesPage">
      <Container>
        <div className="projects-menu">
          <div>
            <div>
              <div>{t('scenes_page.my_scenes')}</div>
            </div>
            <div>
              <div className="actions">
                {renderImportButton()}
                {renderCreateButton()}
              </div>
            </div>
          </div>
          <div className="actions">
            <div>
              <div className="items-count">
                {t('scenes_page.results', {count: projects.length})}
              </div>
            </div>
            <div>{projects.length > 1 ? renderSortDropdown() : null}</div>
          </div>
        </div>
        <div className={classNames('project-cards')}>{renderProjects()}</div>
      </Container>
    </div>
  );
}
