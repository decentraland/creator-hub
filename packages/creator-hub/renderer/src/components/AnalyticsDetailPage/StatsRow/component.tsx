import { Box, Typography } from 'decentraland-ui2';

import './styles.css';

export type Stat = {
  label: string;
  value: string;
};

type Props = {
  stats: Stat[];
};

/** A row of plain figures — no plot, so no hover layer to add. */
export function StatsRow({ stats }: Props) {
  return (
    <Box className="StatsRow">
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
  );
}
