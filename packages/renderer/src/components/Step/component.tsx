import cx from 'classnames';
import CheckIcon from '@mui/icons-material/Check';

import type { Step } from './types';

import './styles.css';

export function Step({ bulletText, name, text, state = 'idle' }: Step) {
  return (
    <div className={cx('Step', state)}>
      <div className="bullet">{state !== 'success' ? bulletText : <CheckIcon />}</div>
      <div className="body">
        <h4>{name}</h4>
        <span>{text}</span>
      </div>
    </div>
  );
}

export function ConnectedSteps({ steps }: { steps: Step[] }) {
  return (
    <div className="ConnectedSteps">
      {steps.map(($, idx) => (
        <Step
          {...$}
          key={idx}
        />
      ))}
    </div>
  );
}
