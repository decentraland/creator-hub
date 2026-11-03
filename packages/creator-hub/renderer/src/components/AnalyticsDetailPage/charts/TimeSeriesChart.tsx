import { useId } from 'react';
import { Box, Typography } from 'decentraland-ui2';
import { ChartsReferenceLine, LineChart } from '@mui/x-charts';

import type { TimeSeriesPoint } from '/shared/types/place-analytics';

import { t } from '/@/modules/store/translation/utils';

import { ChartTooltipContent } from './ChartTooltipContent';
import { EndOfLineLabels, SettlingEndMarks } from './EndOfLineLabels';
import { SeriesGradient } from './SeriesGradient';
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  FINAL_SERIES_ID,
  LABEL_COLOR,
  REFERENCE_COLOR,
  REFERENCE_HEADROOM,
  SERIES_COLOR,
  SETTLING_SERIES_ID,
  chartSx,
  fortnightlyTicks,
  percentTicks,
  seriesPaint,
  tickDateFormat,
  xAxisChrome,
  yAxisChrome,
} from './theme';

import './styles.css';

type Props = {
  points: TimeSeriesPoint[];
  /** Names the series in the tooltip. The chart's own title is its label. */
  seriesName: string;
  formatValue: (value: number) => string;
  /** Upper bound of the y axis; the axis starts at 0. */
  maxValue?: number;
  /** Dashed benchmark drawn across the plot, e.g. the Day 7 target. Always kept in view. */
  reference?: { value: number; label: string };
};

export function TimeSeriesChart({ points, seriesName, formatValue, maxValue, reference }: Props) {
  const gradientId = `series-gradient-${useId().replace(/:/g, '')}`;

  if (points.length === 0) {
    return (
      <Box className="ChartEmpty">
        <Typography variant="body2">{t('analytics.detail.charts.no_data')}</Typography>
      </Box>
    );
  }

  const values = points.map(point => point.value);
  const dataMax = Math.max(...values.map(value => value ?? 0));
  const yMax =
    maxValue ?? (reference ? Math.max(dataMax, reference.value * REFERENCE_HEADROOM) : undefined);
  const lastPoint = points.findLast(point => point.value !== null);
  const lastFinalIndex = points.findLastIndex(point => !point.settling && point.value !== null);
  const lastFinal = points[lastFinalIndex];
  const hasSettling = points.some(point => point.settling);
  const paint = seriesPaint(gradientId);
  const formatPoint = (value: number | null) => (value === null ? '-' : formatValue(value));
  const line = {
    label: seriesName,
    color: SERIES_COLOR,
    curve: 'linear' as const,
    showMark: false,
    valueFormatter: formatPoint,
  };

  return (
    <>
      <LineChart
        height={CHART_HEIGHT}
        margin={CHART_MARGIN}
        sx={chartSx(gradientId)}
        grid={{ horizontal: true }}
        skipAnimation
        axisHighlight={{ x: 'none', y: 'none' }}
        tooltip={{ trigger: 'axis' }}
        xAxis={[
          {
            ...xAxisChrome,
            data: points.map(point => new Date(point.date)),
            scaleType: 'time',
            tickInterval: fortnightlyTicks(points.map(point => point.date)),
            valueFormatter: (date: Date) => tickDateFormat.format(date),
          },
        ]}
        yAxis={[
          {
            ...yAxisChrome,
            min: 0,
            max: yMax,
            tickInterval: percentTicks(maxValue),
            valueFormatter: (value: number) => formatValue(value),
          },
        ]}
        series={[
          ...(hasSettling
            ? [
                {
                  ...line,
                  id: SETTLING_SERIES_ID,
                  data: points.map((point, index) =>
                    point.settling || index === lastFinalIndex ? point.value : null,
                  ),
                },
              ]
            : []),
          {
            ...line,
            id: FINAL_SERIES_ID,
            data: points.map(point => (point.settling ? null : point.value)),
          },
        ]}
        slots={{ axisContent: ChartTooltipContent }}
        slotProps={{ legend: { hidden: true } }}
      >
        <SeriesGradient
          id={gradientId}
          values={values}
        />
        {reference && (
          <ChartsReferenceLine
            y={reference.value}
            label={reference.label}
            labelAlign="end"
            lineStyle={{ stroke: REFERENCE_COLOR, strokeWidth: 1.5, strokeDasharray: '4 4' }}
            labelStyle={{ fill: LABEL_COLOR, fontSize: 14, fontWeight: 600 }}
          />
        )}
        {lastPoint?.value != null &&
          (lastPoint.settling ? (
            <SettlingEndMarks
              end={{ date: lastPoint.date, value: lastPoint.value }}
              lastFinal={
                lastFinal?.value != null
                  ? {
                      date: lastFinal.date,
                      value: lastFinal.value,
                      text: formatValue(lastFinal.value),
                    }
                  : undefined
              }
              paint={paint}
            />
          ) : (
            <EndOfLineLabels
              labels={[
                {
                  key: seriesName,
                  date: lastPoint.date,
                  value: lastPoint.value,
                  color: paint,
                  text: formatValue(lastPoint.value),
                },
              ]}
            />
          ))}
      </LineChart>
      {hasSettling && (
        <Box className="ChartCaption">
          <span className="ChartSwatch Dotted" />
          <Typography variant="body2">
            {t('analytics.detail.retention.day_7_cohort.settling.caption')}
          </Typography>
        </Box>
      )}
    </>
  );
}
