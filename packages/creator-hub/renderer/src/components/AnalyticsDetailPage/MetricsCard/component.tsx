import { Box } from 'decentraland-ui2';

import { type Metric, MetricDisplay } from '../MetricDisplay';

import './styles.css';

type Props = {
  /** A full-width first row, rendered like any other metric. */
  headline?: Metric;
  /** Laid out two per row. */
  metrics: Metric[];
};

export function MetricsCard({ headline, metrics }: Props) {
  return (
    <Box className="MetricsCard">
      {headline && <MetricDisplay {...headline} />}
      <Box className="MetricsGrid">
        {metrics.map(metric => (
          <MetricDisplay
            key={metric.label}
            {...metric}
          />
        ))}
      </Box>
    </Box>
  );
}
