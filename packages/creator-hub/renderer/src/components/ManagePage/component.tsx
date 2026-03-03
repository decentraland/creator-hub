import { Container } from '../Container';
import { Navbar, NavbarItem } from '../Navbar';

import './styles.css';

export function ManagePage() {
  return (
    <main className="ManagePage">
      <Navbar active={NavbarItem.MANAGE} />
      <Container>WIP</Container>
    </main>
  );
}
