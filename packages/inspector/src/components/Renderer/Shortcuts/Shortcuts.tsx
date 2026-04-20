import React from 'react';

import { Button } from '../../Button';
import { Props } from './types';

import './Shortcuts.css';

const Shortcuts: React.FC<Props> = ({ onZoomIn, onZoomOut }) => {
  return (
    <div className="Shortcuts">
      <div className="Buttons">
        <div className="ZoomButtons">
          <Button onClick={onZoomIn}>+</Button>
          <Button onClick={onZoomOut}>-</Button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Shortcuts);
