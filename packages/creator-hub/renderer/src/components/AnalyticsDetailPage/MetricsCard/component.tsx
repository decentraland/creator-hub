import type { ReactNode } from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Tooltip, Typography } from 'decentraland-ui2';

import './styles.css';

export type Metric = {
  label: string;
  /** Explains how the metric is computed. Shown on the label's info icon. */
  tooltip: string;
  value: ReactNode;
  /** MUI palette path, e.g. "success.main". Used for the headline value only. */
  color?: string;
};

type Props = {
  /** The metric this card leads with, rendered larger than the rest. */
  headline: Metric;
  /** A second lead metric beside the first, for pairs read together (D3 and D7 retention). */
  secondaryHeadline?: Metric;
  metrics: Metric[];
};

function MetricLabel({ metric }: { metric: Metric }) {
  return (
    <Box className="MetricLabel">
      <Typography variant="body2">{metric.label}</Typography>
      <Tooltip
        title={metric.tooltip}
        placement="top"
        arrow
      >
        {/* tabIndex so the definition is reachable without a pointer. */}
        <InfoOutlinedIcon
          fontSize="small"
          tabIndex={0}
          aria-label={metric.tooltip}
        />
      </Tooltip>
    </Box>
  );
}

function Headline({ metric }: { metric: Metric }) {
  return (
    <Box className="Metric Headline">
      <MetricLabel metric={metric} />
      <Typography
        variant="h4"
        color={metric.color}
      >
        {metric.value}
      </Typography>
    </Box>
  );
}

export function MetricsCard({ headline, secondaryHeadline, metrics }: Props) {
  return (
    <Box className="MetricsCard">
      {secondaryHeadline ? (
        <Box className="Headlines">
          <Headline metric={headline} />
          <Headline metric={secondaryHeadline} />
        </Box>
      ) : (
        <Headline metric={headline} />
      )}
      <Box className="MetricsGrid">
        {metrics.map(metric => (
          <Box
            className="Metric"
            key={metric.label}
          >
            <MetricLabel metric={metric} />
            <Typography variant="h5">{metric.value}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
