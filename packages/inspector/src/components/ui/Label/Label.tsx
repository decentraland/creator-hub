import React from 'react';
import cx from 'classnames';

import { type Props } from './types';

import './Label.css';

const Label: React.FC<Props> = ({ text, className, header, htmlFor }) => {
  return text ? (
    <label
      className={cx('Label', className, { Header: header })}
      htmlFor={htmlFor}
    >
      {text}
    </label>
  ) : null;
};

export default React.memo(Label);
