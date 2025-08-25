import React from 'react';
import cx from 'classnames';

import { type Props } from './types';

import './Divider.css';

const Divider: React.FC<Props> = ({ label, className }) => {
  return (
    <div className={cx('Divider', className)}>
      {label && <span className="DividerLabel">{label}</span>}
    </div>
  );
};

export default React.memo(Divider);
