import { Box, Typography } from 'decentraland-ui2';

import { type Metric, MetricDisplay } from '../MetricDisplay';

import './styles.css';

type Props = {
  stats: Metric[];
  /** Small print under the figures, e.g. how they are deduplicated. */
  footnote?: string;
};

/** A row of plain figures — no plot, so no hover layer to add. */
export function StatsRow({ stats, footnote }: Props) {
  return (
    <Box className="StatsRow">
      <Box className="Stats">
        {stats.map(stat => (
          <MetricDisplay
            key={stat.label}
            {...stat}
          />
        ))}
      </Box>
      {footnote && (
        <Typography
          variant="caption"
          className="Footnote"
        >
          {footnote}
        </Typography>
      )}
    </Box>
  );
}
