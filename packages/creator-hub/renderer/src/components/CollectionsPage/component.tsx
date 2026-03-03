import { Container } from '../Container';
import { Navbar, NavbarItem } from '../Navbar';

import './styles.css';

export function CollectionsPage() {
  return (
    <main className="CollectionsPage">
      <Navbar active={NavbarItem.COLLECTIONS} />
      <Container>WIP</Container>
    </main>
  );
}
