import { useWorkspace } from '/@/hooks/useWorkspace';

import { Container } from '../Container';
import { Loader } from '../Loader';
import { Navbar, NavbarItem } from '../Navbar';
import { SceneList } from '../SceneList';
import { TutorialsWrapper } from '../Tutorials';

import { sortProjectsBy } from './utils';

import './styles.css';

// MARK: ScenesPage
/** Renders the user's local scenes and the optional tutorials sidebar. */
export function ScenesPage() {
  const { isLoading, projects, settings, sortBy, setSortBy } = useWorkspace();

  return (
    <main className="ScenesPage">
      <Navbar active={NavbarItem.SCENES} />
      <Container>
        <TutorialsWrapper showTutorials={settings.showScenesTutorials}>
          {isLoading ? (
            <Loader size={70} />
          ) : (
            <SceneList
              projects={sortProjectsBy(projects, sortBy)}
              sortBy={sortBy}
              onSort={setSortBy}
            />
          )}
        </TutorialsWrapper>
      </Container>
    </main>
  );
}
