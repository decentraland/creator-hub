import React, { useCallback, useEffect, useRef } from 'react';

import { useSnapState } from '../../../../hooks/editor/useSnap';
import { GizmoType } from '../../../../lib/utils/gizmo';

import './Snap.css';

type Props = {
  gizmo: GizmoType;
};

const MIN_WIDTH = 32;
const MAX_WIDTH = 64;

const Snap: React.FC<Props> = ({ gizmo }) => {
  const [snap, setSnap] = useSnapState(gizmo);
  const inputRef = useRef<HTMLInputElement>(null);

  const resizeInput = useCallback((el: HTMLInputElement) => {
    el.style.width = `${MIN_WIDTH}px`;
    el.style.width = `${Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, el.scrollWidth))}px`;
  }, []);

  useEffect(() => {
    if (inputRef.current) resizeInput(inputRef.current);
  }, [snap, resizeInput]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSnap(e.target.value);
    },
    [setSnap],
  );

  const handleBlur = useCallback(() => {
    const numeric = Number(snap);
    if (numeric < 0 || isNaN(numeric)) {
      setSnap('0');
    } else {
      setSnap(numeric.toString());
    }
  }, [snap, setSnap]);

  let label = '';
  let iconClass = '';
  switch (gizmo) {
    case GizmoType.POSITION:
      label = 'Position';
      iconClass = 'position';
      break;
    case GizmoType.ROTATION:
      label = 'Rotation';
      iconClass = 'rotation';
      break;
    case GizmoType.SCALE:
      label = 'Scale';
      iconClass = 'scale';
      break;
  }

  return (
    <div
      className="Snap"
      data-tooltip={label}
      data-position="bottom center"
      data-inverted
    >
      <div className="label">{label}</div>
      <div className={`snap-icon ${iconClass}`} />
      <input
        ref={inputRef}
        type="number"
        value={snap}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    </div>
  );
};

export default React.memo(Snap);
