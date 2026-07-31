import { Box, Typography } from 'decentraland-ui2';
import { LineChart } from '@mui/x-charts';

import type { TimeSeriesPoint } from '/shared/types/place-analytics';

import { t } from '/@/modules/store/translation/utils';

import { EndOfLineLabels } from './EndOfLineLabels';
import {
  CATEGORICAL_COLORS,
  CHART_HEIGHT,
  CHART_MARGIN,
  COMPACT_CHART_MARGIN,
  SERIES_COLOR,
  chartSx,
  tickDateFormat,
  tooltipDateFormat,
} from './theme';

export type LineSeries = {
  key: string;
  label: string;
  points: TimeSeriesPoint[];
};

type Props = {
  /** Rendered in fixed order, so each series keeps its color across charts. */
  series: LineSeries[];
  formatValue: (value: number) => string;
  maxValue?: number;
  height?: number;
  /** Set when the chart shares a row, so its margins don't crowd out the plot. */
  compact?: boolean;
};

/**
 * Several series over the same weeks. Identity comes from the legend the caller
 * renders above the chart; this only labels each line's last value.
 */
export function MultiLineChart({ series, formatValue, maxValue, height, compact }: Props) {
  const dates = series[0]?.points.map(point => point.date) ?? [];

  if (dates.length === 0) {
    return (
      <Box className="ChartEmpty">
        <Typography variant="body2">{t('analytics.detail.charts.no_data')}</Typography>
      </Box>
    );
  }

  /*
   * A lone series wears the brand color, the same as every other single-series
   * chart in the page; the categorical set is for telling series apart.
   */
  const colorOf = (index: number) =>
    series.length === 1 ? SERIES_COLOR : CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length];

  const endLabels = series
    .map((entry, index) => {
      const lastPoint = [...entry.points].reverse().find(point => point.value !== null);
      return lastPoint?.value == null
        ? null
        : {
            key: entry.key,
            date: lastPoint.date,
            value: lastPoint.value,
            color: colorOf(index),
            text: formatValue(lastPoint.value),
          };
    })
    .filter(label => label !== null);

  return (
    <LineChart
      height={height ?? CHART_HEIGHT}
      margin={compact ? COMPACT_CHART_MARGIN : CHART_MARGIN}
      sx={chartSx}
      grid={{ horizontal: true }}
      skipAnimation
      xAxis={[
        {
          data: dates.map(date => new Date(date)),
          scaleType: 'time',
          tickInterval: dates.filter((_date, index) => index % 2 === 0).map(date => new Date(date)),
          valueFormatter: (date: Date, context) =>
            context.location === 'tooltip'
              ? tooltipDateFormat.format(date)
              : tickDateFormat.format(date),
        },
      ]}
      yAxis={[{ min: 0, max: maxValue, valueFormatter: (value: number) => formatValue(value) }]}
      series={series.map((entry, index) => ({
        id: entry.key,
        data: entry.points.map(point => point.value),
        label: entry.label,
        color: colorOf(index),
        curve: 'linear',
        showMark: false,
        valueFormatter: (value: number | null) => (value === null ? '-' : formatValue(value)),
      }))}
      slotProps={{ legend: { hidden: true } }}
    >
      <EndOfLineLabels labels={endLabels} />
    </LineChart>
  );
}
