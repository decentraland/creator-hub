import React from 'react';
import cx from 'classnames';
import { Label } from '../ui';
import { InfoTooltip } from '../ui/InfoTooltip';
import type { Props } from './types';

import './Block.css';

const Block = React.forwardRef<HTMLDivElement, React.PropsWithChildren<Props>>(
  ({ label, info, error, className, children, onClick }, ref) => {
    return (
      <div
        ref={ref}
        className={cx('Block', className, { error })}
        onClick={onClick}
      >
        <span className="Block-label-row">
          <Label text={label} />
          {info ? (
            <InfoTooltip
              text={info}
              type="help"
            />
          ) : null}
        </span>
        <div className="content">{children}</div>
      </div>
    );
  },
);

export default React.memo(Block);
