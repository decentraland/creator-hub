import { useCallback, useEffect } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import { Container } from 'decentraland-ui2';

import { useDispatch, useSelector } from '#store';
import { t } from '/@/modules/store/reducers/translation/utils';
import { getWorkspace } from '/@/modules/store/reducers/workspace/thunks';

import { Header } from '../Header';
import { Button } from '../Button';
import { SceneList } from '../SceneList';
import { SortBy } from '../SceneList/types';

import './styles.css';

const noop = () => undefined;

export function Home() {
  const dispatch = useDispatch();
  const workspace = useSelector(state => state.workspace);

  const handleClickFeedback = useCallback(() => undefined, []);

  useEffect(() => {
    dispatch(getWorkspace());
  }, []);

  return (
    <main className="Home">
      <Header>
        <>
          {/* TODO: Get SVG for this logo 👇 and transform it into an Icon component */}
          <img src="/assets/images/logo-editor.png" alt={t('home.header.title')} />
          <h4>{t('home.header.title')}</h4>
          <Button color="info" href="https://decentraland.canny.io" onClick={handleClickFeedback}>{t('home.header.feedback')}</Button>
        </>
        <Button color="info" onClick={handleClickFeedback}><SettingsIcon /></Button>
      </Header>
      <Container>
        <SceneList
          projects={workspace.projects}
          sortBy={SortBy.NEWEST}
          onOpenModal={noop}
          onSort={noop}
        />
      </Container>
    </main>
  );
}
