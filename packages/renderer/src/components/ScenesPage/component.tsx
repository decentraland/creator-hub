import { Container } from 'decentraland-ui2';

import { SceneList } from '../SceneList';

import { sortProjectsBy } from './utils';
import { useWorkspace } from '/@/hooks/useWorkspace';

import './styles.css';
import { Navbar, NavbarItem } from '../Navbar';

export function ScenesPage() {
  const { projects, sortBy, setSortBy } = useWorkspace();

  return (
    <main className="ScenesPage">
      <Navbar active={NavbarItem.SCENES} />
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
