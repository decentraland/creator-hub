import type { Props } from './types';

import './styles.css';

export function Header({ children }: Props) {
  const [title, actions] = children;
  return (
    <nav className="Header">
      <div className="left">{title}</div>
      <div className="right">{actions}</div>
    </nav>
  );
}
