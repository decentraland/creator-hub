import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import cx from 'classnames';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import CodeIcon from '@mui/icons-material/Code';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import WidgetsOutlinedIcon from '@mui/icons-material/WidgetsOutlined';
import { CircularProgress as Loader, Typography } from 'decentraland-ui2';

import { misc } from '#preload';

import { type Project } from '/shared/types/projects';
import type { Template } from '/shared/types/workspace';
import { STUDIOS_ADMIN_URL } from '/shared/urls';
import NewScenePng from '/assets/images/new-scene.png';
import { useEditor } from '/@/hooks/useEditor';
import { useWorkspace } from '/@/hooks/useWorkspace';
import { addBase64ImagePrefix } from '/@/modules/image';
import { t } from '/@/modules/store/translation/utils';
import { actions } from '/@/modules/store/settings';
import type { AppState } from '../../modules/store';
import { UpdateAvailableModal } from '../Modals/UpdateAvailableModal';
import { CreateProject } from '../Modals/CreateProject';
import { Navbar, NavbarItem } from '../Navbar';
import { Footer } from '../Footer';
import { DOCS, LearnTab, VIDEOS } from './resources';
import type { HomeCardProps, NewProjectPayload, RowProps } from './types';

import './styles.css';

/** Number of cards shown in each home row — one row's worth, no wrapping. */
const ROW_SIZE = 4;

const Row: React.FC<RowProps> = React.memo(({ title, description, children, onClickTitle }) => (
  <section className="HomeRow">
    <div
      className={cx('HomeRowHeader', { Clickable: !!onClickTitle })}
      onClick={onClickTitle}
    >
      <Typography
        variant="h5"
        className="HomeRowTitle"
      >
        {title}
      </Typography>
      <ChevronRightIcon className="HomeRowChevron" />
    </div>
    {description && <p className="HomeRowDescription">{description}</p>}
    {children}
  </section>
));

const HomeCard: React.FC<HomeCardProps> = React.memo(
  ({ title, description, imageUrl, videoUrl, icon, meta, onClick }) => (
    <div
      className="HomeCard"
      onClick={onClick}
    >
      {icon ? (
        <div className="HomeCardIcon">{icon}</div>
      ) : videoUrl ? (
        <video
          className="HomeCardThumbnail"
          src={videoUrl}
          muted
          loop
        />
      ) : (
        <div
          className="HomeCardThumbnail"
          style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
        />
      )}
      <div className="HomeCardInfo">
        <Typography
          variant="subtitle2"
          className="HomeCardTitle"
        >
          {title}
        </Typography>
        {description && <p className="HomeCardDescription">{description}</p>}
        {meta && <div className="HomeCardMeta">{meta}</div>}
      </div>
    </div>
  ),
);

const MyScenesRow: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { projects, isLoading, runProject } = useWorkspace();

  // Most recently updated first — the row is a shortcut to what the user last touched.
  const recentProjects = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, ROW_SIZE),
    [projects],
  );

  const handleSeeAll = useCallback(() => navigate('/scenes'), [navigate]);
  const handleClickProject = useCallback(
    (project: Project) => () => runProject(project),
    [runProject],
  );

  if (isLoading) return <Loader />;
  if (recentProjects.length === 0) return null;

  return (
    <Row
      title={t('home.rows.my_scenes.title')}
      onClickTitle={handleSeeAll}
    >
      <div className="HomeCardList">
        {recentProjects.map(project => (
          <HomeCard
            key={project.path}
            title={project.title}
            imageUrl={project.thumbnail ? addBase64ImagePrefix(project.thumbnail) : undefined}
            meta={
              <>
                <i className="ParcelIcon" />
                {t('scene_list.parcel_count', { parcels: project.scene.parcels.length })}
              </>
            }
            onClick={handleClickProject(project)}
          />
        ))}
      </div>
    </Row>
  );
});

const TemplatesRow: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { templates, createProject, getAvailableProject } = useWorkspace();
  const [newProject, setNewProject] = useState<NewProjectPayload | undefined>();

  const handleSeeAll = useCallback(() => navigate('/templates'), [navigate]);

  const handleClickTemplate = useCallback(
    (repo?: string) => async () => {
      const [error, data] = await getAvailableProject();
      if (error) return;
      const { name, path } = data;
      setNewProject({
        name,
        path: path.endsWith(name) ? path.slice(0, -name.length) : path,
        repo,
      });
    },
    [getAvailableProject],
  );

  const handleCreateProject = useCallback(
    (value: { name: string; path: string }) => {
      if (!newProject) return;
      createProject({ ...newProject, ...value });
      setNewProject(undefined);
    },
    [createProject, newProject],
  );

  const getThumbnail = useCallback(({ image_1: imageUrl, video_1: videoUrl }: Template) => {
    const assetId = videoUrl || imageUrl;
    if (!assetId) return {};
    const url = `${STUDIOS_ADMIN_URL}/assets/${assetId}`;
    return videoUrl ? { videoUrl: url } : { imageUrl: url };
  }, []);

  return (
    <>
      <Row
        title={t('home.rows.templates.title')}
        description={t('home.rows.templates.description')}
        onClickTitle={handleSeeAll}
      >
        <div className="HomeCardList">
          <HomeCard
            title={t('templates.new_scene.title')}
            description={t('templates.new_scene.description')}
            imageUrl={NewScenePng}
            onClick={handleClickTemplate()}
          />
          {/* -1 leaves room for the "Empty Scene" card so the row stays a single row. */}
          {templates.slice(0, ROW_SIZE - 1).map(template => (
            <HomeCard
              key={template.id}
              title={template.title}
              description={template.description}
              {...getThumbnail(template)}
              onClick={handleClickTemplate(template.github_link)}
            />
          ))}
        </div>
      </Row>
      {newProject && (
        <CreateProject
          open
          initialValue={newProject}
          onClose={() => setNewProject(undefined)}
          onSubmit={handleCreateProject}
        />
      )}
    </>
  );
});

const LearnRow: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<LearnTab>(LearnTab.VIDEOS);

  const handleSeeAll = useCallback(
    () => navigate(tab === LearnTab.VIDEOS ? '/learn/videos' : '/learn/docs'),
    [navigate, tab],
  );

  const handleClickResource = useCallback((url: string) => () => misc.openExternal(url), []);

  const docIcons = [
    <RocketLaunchOutlinedIcon />,
    <CodeIcon />,
    <AccountTreeOutlinedIcon />,
    <WidgetsOutlinedIcon />,
  ];

  return (
    <Row
      title={t('home.rows.learn.title')}
      description={t('home.rows.learn.description')}
      onClickTitle={handleSeeAll}
    >
      <div className="LearnTabs">
        <button
          className={cx('LearnTab', { active: tab === LearnTab.VIDEOS })}
          data-testid="learn-tab-videos"
          onClick={() => setTab(LearnTab.VIDEOS)}
        >
          <MovieOutlinedIcon fontSize="small" />
          {t('home.rows.learn.videos')}
        </button>
        <button
          className={cx('LearnTab', { active: tab === LearnTab.DOCS })}
          data-testid="learn-tab-docs"
          onClick={() => setTab(LearnTab.DOCS)}
        >
          <MenuBookOutlinedIcon fontSize="small" />
          {t('home.rows.learn.documentation')}
        </button>
      </div>
      <div className="HomeCardList">
        {tab === LearnTab.VIDEOS
          ? VIDEOS.slice(0, ROW_SIZE).map(video => (
              <HomeCard
                key={video.id}
                title={video.title}
                description={video.description}
                imageUrl={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                onClick={handleClickResource(
                  `https://youtu.be/${video.id}${video.list ? `?list=${video.list}` : ''}`,
                )}
              />
            ))
          : DOCS.slice(0, ROW_SIZE).map((doc, idx) => (
              <HomeCard
                key={doc.url}
                title={doc.title}
                description={doc.description}
                icon={docIcons[idx % docIcons.length]}
                onClick={handleClickResource(doc.url)}
              />
            ))}
      </div>
    </Row>
  );
});

export function HomePage() {
  const { version } = useEditor();
  const updateInfo = useSelector((state: AppState) => state.settings.updateInfo);
  const openNewUpdateModal = useSelector((state: AppState) => state.settings.openNewUpdateModal);
  const dispatch = useDispatch();

  return (
    <>
      <main className="HomePage">
        <Navbar active={NavbarItem.HOME} />
        <div className="HomeContent">
          <Typography
            variant="h3"
            className="HomeTitle"
          >
            {t('home.header.title')}
          </Typography>
          <MyScenesRow />
          <TemplatesRow />
          <LearnRow />
        </div>
      </main>
      <UpdateAvailableModal
        open={openNewUpdateModal}
        onClose={() => dispatch(actions.setOpenNewUpdateModal(false))}
        version={updateInfo.version ?? ''}
      />
      {version && <Footer version={version} />}
    </>
  );
}
