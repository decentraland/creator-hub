import React from 'react';
import cx from 'classnames';

import { withSdk } from '../../../hoc/withSdk';
import { useTransformInput } from '../../../hooks/editor/useTransformInput';

import './TransformInput.css';

/**
 * Viewport readout for numeric transform entry (#1087) — the live value as it is
 * typed, then a short confirmation of what was applied.
 *
 * Without it the modal would be invisible: the keys are captured with nothing on
 * screen to say so.
 */
const TransformInput = withSdk(({ sdk }) => {
  const { entry, hint, result } = useTransformInput(sdk);

  const isEditing = entry !== null;
  if (!isEditing && result === null) return null;

  return (
    <div className={cx('TransformInput', { 'is-editing': isEditing })}>
      <span className="Entry">{isEditing ? entry : result}</span>
      {isEditing && <span className="Caret" />}
      {isEditing && hint && <span className="Hint">{hint}</span>}
    </div>
  );
});

export default React.memo(TransformInput);
