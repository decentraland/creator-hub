import { Box, Typography } from 'decentraland-ui2';

import './styles.css';

export type Stat = {
  label: string;
  value: string;
};

type Props = {
  stats: Stat[];
  /** Small print under the figures, e.g. how they are deduplicated. */
  footnote?: string;
};

/** A row of plain figures — no plot, so no hover layer to add. */
export function StatsRow({ stats, footnote }: Props) {
  return (
    <Box className="StatsRow">
      <Box className="Stats">
        {stats.map(stat => (
          <Box
            className="Stat"
            key={stat.label}
          >
            <Typography variant="body2">{stat.label}</Typography>
            <Typography variant="h5">{stat.value}</Typography>
          </Box>
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
