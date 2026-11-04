import type { ReactNode } from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, IconButton, Tooltip, Typography } from 'decentraland-ui2';

import './styles.css';

export type Metric = {
  label: string;
  /** Explains how the metric is computed. Shown on the label's info button. */
  tooltip: string;
  value: ReactNode;
  /** Set beside the value at regular weight, e.g. "min". */
  unit?: string;
  /** MUI palette path for the value, e.g. "success.main". */
  color?: string;
};

/** A labelled figure: the label with its info tooltip, then the value. */
export function MetricDisplay({ label, tooltip, value, unit, color }: Metric) {
  return (
    <Box className="MetricDisplay">
      <Box className="MetricLabel">
        <Typography
          variant="body2"
          className="Label"
        >
          {label}
        </Typography>
        <Tooltip
          title={tooltip}
          placement="top"
          arrow
          slotProps={{
            tooltip: { className: 'MetricTooltip' },
            arrow: { className: 'MetricTooltipArrow' },
          }}
        >
          <IconButton
            className="MetricInfo"
            disableFocusRipple
          >
            <InfoOutlinedIcon />
          </IconButton>
        </Tooltip>
      </Box>
      <Typography
        variant="h4"
        component="p"
        className="MetricValue"
        color={color ?? 'var(--palette-neutral-softWhite)'}
      >
        {value}
        {unit && <span className="MetricUnit"> {unit}</span>}
      </Typography>
    </Box>
  );
}
