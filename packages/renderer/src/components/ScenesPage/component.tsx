import { Container } from 'decentraland-ui2';

import { useWorkspace } from '/@/hooks/useWorkspace';
import { SceneList } from '../SceneList';
import { Navbar, NavbarItem } from '../Navbar';
import { sortProjectsBy } from './utils';
import { Tutorials, TutorialsWrapper } from '../Tutorials';

import './styles.css';

export function ScenesPage() {
  const { projects, sortBy, setSortBy } = useWorkspace();

  return (
    <main className="ScenesPage">
      <Navbar active={NavbarItem.SCENES} />
      <Container>
        <TutorialsWrapper>
          <SceneList
            projects={sortProjectsBy(projects, sortBy)}
            sortBy={sortBy}
            onSort={setSortBy}
          />
          <Tutorials />
        </TutorialsWrapper>
      </Container>
    </main>
  );
}
