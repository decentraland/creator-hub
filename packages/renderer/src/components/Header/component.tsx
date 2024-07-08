import type { Props } from './types';

import './styles.css';

export function Header({ children }: Props) {
  const [title, actions] = children;
  return (
    <nav className="Header">
      <div className="title">{title}</div>
      <div className="actions">{actions}</div>
    </nav>
  );
}
