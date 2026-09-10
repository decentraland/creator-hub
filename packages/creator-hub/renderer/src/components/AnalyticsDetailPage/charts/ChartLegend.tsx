import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Tooltip, Typography } from 'decentraland-ui2';

import './styles.css';

export type LegendEntry = {
  label: string;
  color: string;
  /** Explains what the series counts. */
  tooltip?: string;
};

type Props = {
  entries: LegendEntry[];
};

/**
 * Identity for multi-series charts. Always rendered when there is more than one
 * series, so identity never depends on color alone.
 */
export function ChartLegend({ entries }: Props) {
  return (
    <Box className="ChartLegend">
      {entries.map(entry => (
        <Box
          className="LegendEntry"
          key={entry.label}
        >
          <Box
            className="LegendKey"
            style={{ backgroundColor: entry.color }}
          />
          <Typography variant="body2">{entry.label}</Typography>
          {entry.tooltip && (
            <Tooltip
              title={entry.tooltip}
              placement="top"
              arrow
            >
              <InfoOutlinedIcon
                fontSize="small"
                tabIndex={0}
                aria-label={entry.tooltip}
              />
            </Tooltip>
          )}
        </Box>
      ))}
    </Box>
  );
}
