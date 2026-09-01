import ArrowDownIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpIcon from '@mui/icons-material/ArrowUpward';
import { Box, Typography } from 'decentraland-ui2';

import './styles.css';

type Props = {
  value: string;
  /** Small unit set beside the value, e.g. "min". */
  unit?: string;
  /** Change against the previous period, already formatted. */
  delta?: { text: string; direction: 'up' | 'down' | 'flat' };
};

/** The figure a card leads with, plus how it moved. */
export function HeroStat({ value, unit, delta }: Props) {
  return (
    <Box className="HeroStat">
      <Box className="Value">
        <Typography variant="h4">{value}</Typography>
        {unit && (
          <Typography
            variant="body1"
            className="Unit"
          >
            {unit}
          </Typography>
        )}
      </Box>
      {delta && delta.direction !== 'flat' && (
        <Box className={`Delta ${delta.direction === 'up' ? 'Up' : 'Down'}`}>
          {delta.direction === 'up' ? (
            <ArrowUpIcon fontSize="small" />
          ) : (
            <ArrowDownIcon fontSize="small" />
          )}
          <Typography variant="body2">{delta.text}</Typography>
        </Box>
      )}
    </Box>
  );
}
