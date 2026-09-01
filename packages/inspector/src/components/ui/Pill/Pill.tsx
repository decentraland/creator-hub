import React from 'react';
import { IoIosClose as CloseIcon } from 'react-icons/io';
import cx from 'classnames';

import type { Props } from './types';

import './Pill.css';

const Pill: React.FC<Props> = ({ className, content, removeLabel, onRemove }) => {
  return (
    <div className={cx('Pill', className)}>
      <div
        className="Content"
        title={typeof content === 'string' ? content : undefined}
      >
        {content}
      </div>
      <button
        type="button"
        className="RemoveButton"
        aria-label={removeLabel}
        onClick={onRemove}
      >
        <CloseIcon />
      </button>
    </div>
  );
};

export default React.memo(Pill);
