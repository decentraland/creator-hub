import { useCallback } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import { Container } from 'decentraland-ui2';
import logo from '/assets/images/logo-editor.png';
import { t } from '/@/modules/store/translation/utils';

import { Header } from '../Header';
import { Button } from '../Button';
import { SceneList } from '../SceneList';

import { sortProjectsBy } from './utils';
import { useWorkspace } from '/@/hooks/useWorkspace';

import './styles.css';

export function Home() {
  const { projects, sortBy, setSortBy } = useWorkspace();

  const handleClickFeedback = useCallback(() => undefined, []);
  const handleClickOptions = useCallback(() => undefined, []);

  return (
    <main className="Home">
      <Header>
        <>
          {/* TODO: Get SVG for this logo 👇 and transform it into an Icon component */}
          <img
            src={logo}
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
          projects={sortProjectsBy(projects, sortBy)}
          sortBy={sortBy}
          onSort={setSortBy}
        />
      </Container>
    </main>
  );
}
