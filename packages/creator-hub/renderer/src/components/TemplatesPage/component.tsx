import { useCallback, useState } from 'react';
import { Chip, Typography } from 'decentraland-ui2';

import type { Template } from '/shared/types/workspace';

import { useWorkspace } from '/@/hooks/useWorkspace';
import { ProjectCard } from '/@/components/ProjectCard';
import { t } from '/@/modules/store/translation/utils';

import { CreateProject } from '../Modals/CreateProject';

import { SortBy, type ModalType, type CreateProjectValue } from './types';
import { sortTemplatesBy } from './utils';

import { misc } from '#preload';

import './styles.css';

const TemplateCardDropdownIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path
      stroke="none"
      d="M0 0h24v24H0z"
      fill="none"
    />
    <path d="M7 8l-4 4l4 4" />
    <path d="M17 8l4 4l-4 4" />
    <path d="M14 4l-4 16" />
  </svg>
);

export function TemplatesPage() {
  const { createProject, templates: _templates, getAvailableProject } = useWorkspace();
  const [openModal, setOpenModal] = useState<ModalType | undefined>();
  const [templates, setTemplates] = useState(_templates);
  const [sortBy] = useState(SortBy.DEFAULT);

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

  /* View Code is the direct icon action; dropdown only has Preview when available */
  const dropdownOptions = useCallback((template: Template) => {
    if (!template.play_link) return [];
    return [
      {
        text: t('templates.actions.preview'),
        handler: handlePreviewTemplate(template),
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

  return (
    <div className="TemplatesPage">
      <div className="TemplatesHeader">
        <Typography variant="h3">{t('templates.title')}</Typography>
      </div>

      <div className="TemplatesGrid">
        {sortTemplatesBy(templates, sortBy).map(template => (
          <ProjectCard
            key={template.id}
            title={template.title.replace(/\s+Template$/i, '')}
            description={template.description}
            {...getTemplateThumbnailUrl(template)}
            dropdownOptions={dropdownOptions(template)}
            dropdownIcon={<TemplateCardDropdownIcon />}
            dropdownIconTitle={t('templates.actions.code')}
            dropdownIconClick={handleViewCode(template)}
            onClick={handleClickTemplate(template.github_link)}
            content={
              <span className="TemplateCardTags">
                {(template.tags || []).map($ => (
                  <Chip
                    key={$}
                    label={$}
                    color="default"
                    size="medium"
                    variant="outlined"
                  />
                ))}
              </span>
            }
          />
        ))}
      </div>
      {openModal?.type === 'create-project' && (
        <CreateProject
          open
          initialValue={openModal.payload}
          onClose={() => setOpenModal(undefined)}
          onSubmit={value => handleCreateProject({ ...openModal.payload, ...value })}
        />
      )}
    </div>
  );
}
