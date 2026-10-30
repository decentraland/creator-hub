import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MenuItem, type SelectChangeEvent, Chip, Typography } from 'decentraland-ui2';

import { useWorkspace } from '/@/hooks/useWorkspace';
import { ProjectCard } from '/@/components/ProjectCard';
import { t } from '/@/modules/store/translation/utils';
import { TEMPLATES, Difficulty, type Template } from '/@/modules/templates';

import NewScenePng from '/assets/images/new-scene.png';

import { misc } from '#preload';
import { Container } from '../Container';
import { FiltersBar } from '../FiltersBar';
import { Navbar, NavbarItem } from '../Navbar';
import { Select } from '../Select';
import { Title } from '../Title';
import { TutorialsWrapper } from '../Tutorials';
import { CreateProject } from '../Modals/CreateProject';

import { SortBy, type ModalType, type CreateProjectValue } from './types';
import { sortTemplatesBy } from './utils';

import './styles.css';

// A chip that matches no template would only ever filter down to the Empty Scene card.
const DIFFICULTY_FILTERS = (
  [
    { value: Difficulty.EASY, label: 'templates.filters.difficulty.easy' },
    { value: Difficulty.INTERMEDIATE, label: 'templates.filters.difficulty.medium' },
    { value: Difficulty.HARD, label: 'templates.filters.difficulty.hard' },
  ] as const
).filter(({ value }) => TEMPLATES.some($ => $.difficulty === value));

export function TemplatesPage() {
  const navigate = useNavigate();
  const { createProject, getAvailableProject } = useWorkspace();
  const [openModal, setOpenModal] = useState<ModalType | undefined>();
  const [templates, setTemplates] = useState(TEMPLATES);
  const [sortBy, setSortBy] = useState(SortBy.DEFAULT);
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>();

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleClickTemplate = useCallback(
    (repo?: string) => async () => {
      const [error, data] = await getAvailableProject();
      if (!error) {
        const { name, path } = data;
        const payload = {
          name,
          path: path.endsWith(name) ? path.slice(0, -name.length) : path,
          repo,
        };
        setOpenModal({ type: 'create-project', payload });
      }
    },
    [getAvailableProject],
  );

  const handleCreateProject = useCallback(
    (value: CreateProjectValue) => {
      createProject(value);
      setOpenModal(undefined);
    },
    [createProject],
  );

  const handleViewCode = useCallback(
    ({ repo }: Template) =>
      () => {
        misc.openExternal(repo);
      },
    [],
  );

  const handleClickDifficulty = useCallback((value?: Difficulty) => {
    setDifficulty(value);
    setTemplates(value ? TEMPLATES.filter($ => $.difficulty === value) : TEMPLATES);
  }, []);

  const handleSort = useCallback((value: SortBy) => {
    setSortBy(value);
  }, []);

  const dropdownOptions = useCallback(
    (template: Template) => [
      {
        text: t('templates.actions.code'),
        handler: handleViewCode(template),
      },
    ],
    [],
  );

  const count = templates.length + 1; // +1 for empty scene...

  return (
    <main className="TemplatesPage">
      <Navbar active={NavbarItem.TEMPLATES} />
      <Container>
        <TutorialsWrapper>
          <Title
            value={t('templates.title')}
            onBack={handleBack}
          />
          <FiltersBar>
            <>
              <Typography variant="h6">{t('templates.results', { count })}</Typography>
              <Filters
                value={difficulty}
                onClick={handleClickDifficulty}
              />
            </>
            <Sort
              value={sortBy}
              onChange={handleSort}
            />
          </FiltersBar>
          <div className="template-list">
            <ProjectCard
              title={t('templates.new_scene.title')}
              description={t('templates.new_scene.description')}
              imageUrl={NewScenePng}
              width={300}
              height={480}
              onClick={handleClickTemplate()}
            />
            {sortTemplatesBy(templates, sortBy).map(template => (
              <ProjectCard
                key={template.id}
                title={template.title}
                description={template.description}
                imageUrl={template.imageUrl}
                videoUrl={template.videoUrl}
                dropdownOptions={dropdownOptions(template)}
                width={300}
                height={480}
                onClick={handleClickTemplate(template.repo)}
                content={template.tags.map($ => (
                  <Chip
                    key={$}
                    label={$}
                    color="default"
                    size="medium"
                    variant="outlined"
                  />
                ))}
              />
            ))}
          </div>
        </TutorialsWrapper>
      </Container>
      {openModal?.type === 'create-project' && (
        <CreateProject
          open
          initialValue={openModal.payload}
          onClose={() => setOpenModal(undefined)}
          onSubmit={value => handleCreateProject({ ...openModal.payload, ...value })}
        />
      )}
    </main>
  );
}

function Filters({
  value,
  onClick,
}: {
  value?: Difficulty;
  onClick: (value?: Difficulty) => void;
}) {
  const handleClick = useCallback(
    (difficulty: Difficulty) => () => {
      onClick(difficulty === value ? undefined : difficulty);
    },
    [value],
  );

  return (
    <div className="filter-by">
      <Typography variant="body1">{t('templates.filters.title')}</Typography>
      {DIFFICULTY_FILTERS.map(filter => (
        <Chip
          key={filter.value}
          label={t(filter.label)}
          color="default"
          size="medium"
          variant={value === filter.value ? 'filled' : 'outlined'}
          clickable
          onClick={handleClick(filter.value)}
        />
      ))}
    </div>
  );
}

function Sort({ value, onChange }: { value: SortBy; onChange: (value: SortBy) => void }) {
  const handleSort = useCallback((e: SelectChangeEvent<SortBy>) => {
    onChange(e.target.value as SortBy);
  }, []);

  return (
    <>
      <p>{t('templates.sort.title')}</p>
      <Select
        variant="standard"
        value={value}
        onChange={handleSort}
      >
        <MenuItem
          className="sort-item"
          value={SortBy.DEFAULT}
        >
          {t('templates.sort.default')}
        </MenuItem>
        <MenuItem
          className="sort-item"
          value={SortBy.NEWEST}
        >
          {t('templates.sort.newest')}
        </MenuItem>
      </Select>
    </>
  );
}
