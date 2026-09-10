import type { AxisValueFormatterContext } from '@mui/x-charts/models/axis';
import { Box, Typography } from 'decentraland-ui2';
import { BarChart } from '@mui/x-charts';
import type { AxisConfig, ChartsXAxisProps } from '@mui/x-charts';

import { t } from '/@/modules/store/translation/utils';

import { CATEGORICAL_COLORS, CHART_HEIGHT, CHART_MARGIN, chartSx } from './theme';

import './styles.css';

const tickDateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const tooltipDateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export type StackedSeries = {
  key: string;
  label: string;
  /** One value per week, aligned with `dates`. */
  values: Array<number | null>;
};

type Props = {
  /** Epoch milliseconds, one per bar. */
  dates: number[];
  series: StackedSeries[];
  formatValue: (value: number) => string;
};

/**
 * Weekly composition. Segments are separated by a 2px surface-colored gap
 * rather than an outline, and the whole bar carries one tooltip listing every
 * series, so the reader never has to hit a single segment.
 */
export function StackedBarChart({ dates, series, formatValue }: Props) {
  if (dates.length === 0) {
    return (
      <Box className="ChartEmpty">
        <Typography variant="body2">{t('analytics.detail.charts.no_data')}</Typography>
      </Box>
    );
  }

  /*
   * Typed explicitly: the xAxis prop is a union over every scale type, so the
   * band-only options (the gap that caps bar thickness) don't narrow inline.
   */
  const xAxis: Omit<AxisConfig<'band', Date, ChartsXAxisProps>, 'id'> = {
    data: dates.map(date => new Date(date)),
    scaleType: 'band',
    // Leftover band space is air: holds bars at the 24px cap instead of filling the slot.
    categoryGapRatio: 0.56,
    valueFormatter: (date: Date, context: AxisValueFormatterContext) =>
      context.location === 'tooltip' ? tooltipDateFormat.format(date) : tickDateFormat.format(date),
    // A label per weekly bar crowds the axis; label every other one.
    tickInterval: (_value: Date, index: number) => index % 2 === 0,
  };

  return (
    <BarChart
      className="StackedBars"
      height={CHART_HEIGHT}
      margin={CHART_MARGIN}
      sx={chartSx}
      grid={{ horizontal: true }}
      skipAnimation
      borderRadius={4}
      xAxis={[xAxis]}
      yAxis={[{ valueFormatter: (value: number) => formatValue(value) }]}
      series={series.map((entry, index) => ({
        id: entry.key,
        data: entry.values,
        label: entry.label,
        stack: 'users',
        color: CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length],
        valueFormatter: (value: number | null) => (value === null ? '-' : formatValue(value)),
      }))}
      slotProps={{ legend: { hidden: true } }}
    />
  );
}
