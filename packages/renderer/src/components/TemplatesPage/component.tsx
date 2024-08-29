import { Button } from 'decentraland-ui2';
import { useWorkspace } from '/@/hooks/useWorkspace';
import { Container } from '../Container';
import { Navbar, NavbarItem } from '../Navbar';

import './styles.css';
import { TutorialsWrapper } from '../Tutorials';

export function TemplatesPage() {
  const { createProject } = useWorkspace();
  return (
    <main className="TemplatesPage">
      <Navbar active={NavbarItem.SCENES} />
      <Container>
        <TutorialsWrapper>
          <Button onClick={createProject}>Create Scene</Button>
        </TutorialsWrapper>
      </Container>
    </main>
  );
}
