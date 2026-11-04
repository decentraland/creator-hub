import { useId } from 'react';
import { Box, Typography } from 'decentraland-ui2';
import { LineChart } from '@mui/x-charts';

import type { TimeSeriesPoint } from '/shared/types/place-analytics';

import { t } from '/@/modules/store/translation/utils';

import { ChartTooltipContent } from './ChartTooltipContent';
import { EndOfLineLabels } from './EndOfLineLabels';
import { SeriesGradient } from './SeriesGradient';
import {
  CATEGORICAL_COLORS,
  CHART_HEIGHT,
  CHART_MARGIN,
  SERIES_COLOR,
  chartSx,
  fortnightlyTicks,
  seriesPaint,
  tickDateFormat,
  xAxisChrome,
  yAxisChrome,
} from './theme';

export type LineSeries = {
  key: string;
  label: string;
  points: TimeSeriesPoint[];
};

type Props = {
  /** Rendered in fixed order, so each series keeps its color across charts. A lone series wears the brand gradient. */
  series: LineSeries[];
  formatValue: (value: number) => string;
  maxValue?: number;
  height?: number;
};

/** Several series over the same weeks, each labelled at its last value; the caller renders the legend. */
export function MultiLineChart({ series, formatValue, maxValue, height }: Props) {
  const isSingle = series.length === 1;
  const id = `series-gradient-${useId().replace(/:/g, '')}`;
  const gradientId = isSingle ? id : undefined;
  const dates = series[0]?.points.map(point => point.date) ?? [];

  if (dates.length === 0) {
    return (
      <Box className="ChartEmpty">
        <Typography variant="body2">{t('analytics.detail.charts.no_data')}</Typography>
      </Box>
    );
  }

  const colorOf = (index: number) =>
    isSingle ? SERIES_COLOR : CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length];

  const endLabels = series
    .map((entry, index) => {
      const lastPoint = [...entry.points].reverse().find(point => point.value !== null);
      return lastPoint?.value == null
        ? null
        : {
            key: entry.key,
            date: lastPoint.date,
            value: lastPoint.value,
            color: isSingle ? seriesPaint(gradientId) : colorOf(index),
            text: formatValue(lastPoint.value),
          };
    })
    .filter(label => label !== null);

  return (
    <LineChart
      height={height ?? CHART_HEIGHT}
      margin={CHART_MARGIN}
      sx={chartSx(gradientId)}
      grid={{ horizontal: true }}
      skipAnimation
      axisHighlight={{ x: 'none', y: 'none' }}
      tooltip={{ trigger: 'axis' }}
      xAxis={[
        {
          ...xAxisChrome,
          data: dates.map(date => new Date(date)),
          scaleType: 'time',
          tickInterval: fortnightlyTicks(dates),
          valueFormatter: (date: Date) => tickDateFormat.format(date),
        },
      ]}
      yAxis={[
        {
          ...yAxisChrome,
          min: 0,
          max: maxValue,
          valueFormatter: (value: number) => formatValue(value),
        },
      ]}
      series={series.map((entry, index) => ({
        id: entry.key,
        data: entry.points.map(point => point.value),
        label: entry.label,
        color: colorOf(index),
        curve: 'linear',
        showMark: false,
        valueFormatter: (value: number | null) => (value === null ? '-' : formatValue(value)),
      }))}
      slots={{ axisContent: ChartTooltipContent }}
      slotProps={{ legend: { hidden: true } }}
    >
      {gradientId && (
        <SeriesGradient
          id={gradientId}
          values={series[0].points.map(point => point.value)}
        />
      )}
      <EndOfLineLabels labels={endLabels} />
    </LineChart>
  );
}
