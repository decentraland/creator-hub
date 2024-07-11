import { useCallback, useEffect } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import { Container } from 'decentraland-ui2';

import { useDispatch, useSelector } from '#store';
import { type SortBy } from '/shared/types/projects';
import { t } from '/@/modules/store/reducers/translation/utils';
import { actions as workspaceActions } from '/@/modules/store/reducers/workspace/index';
import { getWorkspace } from '/@/modules/store/reducers/workspace/thunks';

import { Header } from '../Header';
import { Button } from '../Button';
import { SceneList } from '../SceneList';

import { sortProjectsBy } from './utils';

import './styles.css';

const noop = () => undefined;

export function Home() {
  const dispatch = useDispatch();
  const workspace = useSelector(state => state.workspace);

  const handleClickFeedback = useCallback(() => undefined, []);
  const handleClickOptions = useCallback(() => undefined, []);

  useEffect(() => {
    dispatch(getWorkspace());
  }, []);

  const handleSceneSort = useCallback(
    (type: SortBy) => {
      dispatch(workspaceActions.setSortProjectsBy(type));
    },
    [workspace.sortBy],
  );

  return (
    <main className="Home">
      <Header>
        <>
          {/* TODO: Get SVG for this logo 👇 and transform it into an Icon component */}
          <img
            src="/assets/images/logo-editor.png"
            alt={t('home.header.title')}
          />
          <h4>{t('home.header.title')}</h4>
          <Button
            color="info"
            href="https://decentraland.canny.io"
            onClick={handleClickFeedback}
          >
            {t('home.header.feedback')}
          </Button>
        </>
        <Button
          color="info"
          onClick={handleClickOptions}
        >
          <SettingsIcon />
        </Button>
      </Header>
      <Container>
        <SceneList
          projects={sortProjectsBy(workspace.projects, workspace.sortBy)}
          sortBy={workspace.sortBy}
          onOpenModal={noop}
          onSort={handleSceneSort}
        />
      </Container>
    </main>
  );
}
