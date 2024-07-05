import { useCallback, useEffect } from 'react';
import { Button } from 'decentraland-ui2';
import SettingsIcon from '@mui/icons-material/Settings';

import { useDispatch, useSelector } from '#store';
import { t } from '/@/modules/store/reducers/translation/utils';
import { getWorkspace } from '/@/modules/store/reducers/workspace/thunks';

import { Header } from '../Header';
import { SceneList } from '../SceneList';
import { SortBy } from '../SceneList/types';

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
          <img src="/assets/images/logo-editor.png" alt={t('home.header.title')} />
          <h4>{t('home.header.title')}</h4>
          <Button className="feedback" onClick={handleClickFeedback}>{t('home.header.feedback')}</Button>
        </>
        <>
          <SettingsIcon />
        </>
      </Header>
      <SceneList
        projects={workspace.projects}
        sortBy={SortBy.NEWEST}
        onOpenModal={noop}
        onSort={noop}
      />
    </main>
  );
}
