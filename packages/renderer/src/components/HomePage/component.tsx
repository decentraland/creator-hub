import { Container } from 'decentraland-ui2';
import { Navbar, NavbarItem } from '../Navbar';

import './styles.css';

export function HomePage() {
  return (
    <main className="HomePage">
      <Navbar active={NavbarItem.HOME} />
      <Container>WIP</Container>
    </main>
  );
}
