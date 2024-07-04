import { type MouseEvent, type KeyboardEvent, useCallback } from 'react';
import classNames from 'classnames';

import type { Props } from './types';

import './styles.css';
import './sprite.css';

const noop = (_: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
  /* noop */
};

const isClickEvent = (
  e: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
): e is MouseEvent<HTMLElement> => e.type === 'click';

const isKeyboardEvent = (
  e: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
): e is KeyboardEvent<HTMLElement> => (e as KeyboardEvent).key !== ' ';

export function Icon(props: Props) {
  const { name, isActive = false, onClick, className = '' } = props;
  const iconName = isActive ? `${name}-active` : name;

  const handleEvent = useCallback(
    (e: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
      if (!onClick) return noop(e);
      if (isClickEvent(e)) return onClick(e);
      if (isKeyboardEvent(e)) return undefined; // handle keyboard event for accessibility...
      return undefined;
    },
    [onClick],
  );

  return (
    <div
      className={classNames(
        'Icon',
        iconName,
        { clickeable: !!onClick },
        className,
      )}
      onClick={handleEvent}
      onKeyUp={handleEvent}
    />
  );
}
