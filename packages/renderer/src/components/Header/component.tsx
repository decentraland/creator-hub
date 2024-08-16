import cx from 'classnames';
import type { Props } from './types';

import './styles.css';

export function Header({ children, classNames }: Props) {
  const [title, actions] = children;
  return (
    <nav className={cx('Header', classNames)}>
      <div className="left">{title}</div>
      <div className="right">{actions}</div>
    </nav>
  );
}
