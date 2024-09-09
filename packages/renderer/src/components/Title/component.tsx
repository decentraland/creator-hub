import { Typography } from 'decentraland-ui2';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';

import type { Props } from './types';

import './styles.css';

export function Title({ value, onBack }: Props) {
  return (
    <div className="Title">
      <div
        className="back"
        onClick={onBack}
      >
        <ArrowBackIosIcon />
      </div>
      <Typography variant="h4">{value}</Typography>
    </div>
  );
}
