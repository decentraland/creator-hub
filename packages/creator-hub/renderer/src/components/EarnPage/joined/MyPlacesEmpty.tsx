import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Events } from '/shared/types/analytics';
import type { Project } from '/shared/types/projects';

import { analytics } from '#preload';
import { useWorkspace } from '/@/hooks/useWorkspace';
import { addBase64ImagePrefix } from '/@/modules/image';
import { t } from '/@/modules/store/translation/utils';

import { ModalCta } from '../EarnModal.styled';
import { ParcelsIcon } from '../icons';

import {
  Actions,
  Body,
  Card,
  CardName,
  CardParcels,
  CardText,
  CardThumbnail,
  Cards,
  Header,
  NoScenesState,
  Scenes,
  ScenesHeading,
  Title,
  UnpublishedState,
} from './MyPlacesEmpty.styled';
import { ListState } from './parts';
import { findPublishedPaths } from './publishedScenes';

const SHOWN_SCENES = 3;

const trackEmptyStateAction = (action: Events['Creator Fund Empty State Action']['action']) =>
  void analytics.track('Creator Fund Empty State Action', { action });

const newestEditsFirst = (projects: Project[]) =>
  [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, SHOWN_SCENES);

function useUnpublishedProjects(projects: Project[]) {
  const [checked, setChecked] = useState<{ projects: Project[]; unpublished: Project[] } | null>(
    null,
  );
  useEffect(() => {
    let current = true;
    void findPublishedPaths(projects).then(published => {
      if (!current) return;
      setChecked({
        projects,
        unpublished: newestEditsFirst(projects.filter(project => !published.has(project.path))),
      });
    });
    return () => {
      current = false;
    };
  }, [projects]);
  return checked?.projects === projects ? checked.unpublished : null;
}

/** A local scene as the design-system Scene-Card, with no menu; it opens the scene. */
export function UnpublishedSceneCard({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: (project: Project) => void;
}) {
  const nameId = useId();
  return (
    <Card
      type="button"
      aria-labelledby={nameId}
      onClick={() => onOpen(project)}
    >
      <CardThumbnail
        src={project.thumbnail ? addBase64ImagePrefix(project.thumbnail) : undefined}
        alt=""
        width={416}
        height={273}
        loading="lazy"
      />
      <CardText>
        <CardName
          id={nameId}
          title={project.title}
        >
          {project.title}
        </CardName>
        <CardParcels>
          <ParcelsIcon />
          {t('earn.joined.my_places.unpublished.parcels', {
            parcels: project.scene.parcels.length,
          })}
        </CardParcels>
      </CardText>
    </Card>
  );
}

function UnpublishedScenes({ projects }: { projects: Project[] }) {
  const { runProject } = useWorkspace();
  const headingId = useId();
  return (
    <Scenes aria-labelledby={headingId}>
      <ScenesHeading id={headingId}>{t('earn.joined.my_places.unpublished.heading')}</ScenesHeading>
      <Cards>
        {projects.map(project => (
          <UnpublishedSceneCard
            key={project.path}
            project={project}
            onOpen={scene => {
              trackEmptyStateAction('open_scene');
              runProject(scene);
            }}
          />
        ))}
      </Cards>
    </Scenes>
  );
}

function NoScenes() {
  const navigate = useNavigate();
  const { createProject } = useWorkspace();
  return (
    <NoScenesState>
      <Title>{t('earn.joined.my_places.no_scenes.title')}</Title>
      <Body>{t('earn.joined.my_places.empty_body')}</Body>
      <Actions>
        <ModalCta
          variant="contained"
          color="secondary"
          onClick={() => {
            trackEmptyStateAction('start_from_template');
            navigate('/templates');
          }}
        >
          {t('earn.joined.my_places.start_from_template')}
        </ModalCta>
        <ModalCta
          variant="contained"
          color="primary"
          onClick={() => {
            trackEmptyStateAction('create_scene');
            createProject({});
          }}
        >
          {t('earn.joined.my_places.create_scene')}
        </ModalCta>
      </Actions>
    </NoScenesState>
  );
}

export type MyPlacesEmptyProps =
  | { variant: 'no_scenes' }
  | { variant: 'unpublished'; projects: Project[] };

function PublishPrompt({ projects }: { projects: Project[] }) {
  const unpublished = useUnpublishedProjects(projects);
  if (!unpublished) return <ListState kind="loading" />;
  return (
    <UnpublishedState>
      <Header>
        <Title>{t('earn.joined.my_places.unpublished.title')}</Title>
        <Body>{t('earn.joined.my_places.empty_body')}</Body>
      </Header>
      {unpublished.length > 0 && <UnpublishedScenes projects={unpublished} />}
    </UnpublishedState>
  );
}

/** My Places in the current cycle with no places: create a first scene, or publish one. */
export function MyPlacesEmpty(props: MyPlacesEmptyProps) {
  return props.variant === 'no_scenes' ? <NoScenes /> : <PublishPrompt projects={props.projects} />;
}
