import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, MenuItem, type SelectChangeEvent, Chip } from 'decentraland-ui2';

import { misc } from '#preload';

import type { Template } from '/shared/types/workspace';

import { useWorkspace } from '/@/hooks/useWorkspace';
import { ProjectCard } from '/@/components/ProjectCard';
import { t } from '/@/modules/store/translation/utils';

import NewScenePng from '/assets/images/new-scene.png';

import { Container } from '../Container';
import { FiltersBar } from '../FiltersBar';
import { Navbar, NavbarItem } from '../Navbar';
import { Select } from '../Select';
import { Title } from '../Title';
import { TutorialsWrapper } from '../Tutorials';

import { SortBy, Difficulty } from './types';
import { sortTemplatesBy } from './utils';

import './styles.css';

export function TemplatesPage() {
  const navigate = useNavigate();
  const { createProject, templates: _templates } = useWorkspace();
  const [templates, setTemplates] = useState(_templates);
  const [sortBy, setSortBy] = useState(SortBy.DEFAULT);
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>();

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const handleClickTemplate = useCallback(
    (repo?: string) => () => {
      createProject({ repo });
    },
    [createProject],
  );

  const handlePreviewTemplate = useCallback(
    ({ play_link: link }: Template) =>
      () => {
        if (link) misc.openExternal(link);
      },
    [],
  );

  const handleViewCode = useCallback(
    ({ github_link: link }: Template) =>
      () => {
        misc.openExternal(link);
      },
    [],
  );

  const handleClickDifficulty = useCallback(
    (value?: Difficulty) => {
      const templates = value ? _templates.filter($ => $.difficulty_level === value) : _templates;
      setDifficulty(value);
      setTemplates(templates);
    },
    [_templates],
  );

  const handleSort = useCallback((value: SortBy) => {
    setSortBy(value);
  }, []);

  const dropdownOptions = useCallback((template: Template) => {
    const previewOption = template.play_link
      ? [
          {
            text: t('templates.actions.preview'),
            handler: handlePreviewTemplate(template),
          },
        ]
      : [];

    return [
      ...previewOption,
      {
        text: t('templates.actions.code'),
        handler: handleViewCode(template),
      },
    ];
  }, []);

  const getTemplateThumbnailUrl = useCallback(
    ({ image_1: imageUrl, video_1: videoUrl }: Template) => {
      const assetId = videoUrl || imageUrl;
      if (!assetId) return undefined;
      const url = `https://admin.dclstudios.org/assets/${assetId}`;
      return videoUrl ? { videoUrl: url } : { imageUrl: url };
    },
    [],
  );

  const count = templates.length + 1; // +1 for empty scene...

  return (
    <main className="TemplatesPage">
      <Navbar active={NavbarItem.SCENES} />
      <Container>
        <TutorialsWrapper>
          <Title
            value={t('templates.title')}
            onBack={handleBack}
          />
          <FiltersBar>
            <>
              <span>{t('templates.results', { count })}</span>
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
          <Box
            display="grid"
            gridTemplateColumns="repeat(3, 1fr)"
            gap={2}
          >
            <ProjectCard
              title={t('templates.new_scene.title')}
              description={t('templates.new_scene.description')}
              imageUrl={NewScenePng}
              width={344}
              height={480}
              onClick={handleClickTemplate()}
            />
            {sortTemplatesBy(templates, sortBy).map(template => (
              <ProjectCard
                key={template.id}
                title={template.title}
                description={template.description}
                {...getTemplateThumbnailUrl(template)}
                dropdownOptions={dropdownOptions(template)}
                width={344}
                height={480}
                onClick={handleClickTemplate(template.github_link)}
                content={(template.tags || []).map($ => (
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
          </Box>
        </TutorialsWrapper>
      </Container>
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
      {t('templates.filters.title')}
      <Chip
        label={t('templates.filters.difficulty.easy')}
        color="default"
        size="medium"
        variant={value === Difficulty.EASY ? 'filled' : 'outlined'}
        clickable
        onClick={handleClick(Difficulty.EASY)}
      />
      <Chip
        label={t('templates.filters.difficulty.medium')}
        color="default"
        size="medium"
        variant={value === Difficulty.INTERMEDIATE ? 'filled' : 'outlined'}
        clickable
        onClick={handleClick(Difficulty.INTERMEDIATE)}
      />
      <Chip
        label={t('templates.filters.difficulty.hard')}
        color="default"
        size="medium"
        variant={value === Difficulty.HARD ? 'filled' : 'outlined'}
        clickable
        onClick={handleClick(Difficulty.HARD)}
      />
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