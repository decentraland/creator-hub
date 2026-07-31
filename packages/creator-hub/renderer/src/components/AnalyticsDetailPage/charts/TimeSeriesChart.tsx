import { useDrawingArea, useXScale, useYScale } from '@mui/x-charts/hooks';
import { Box, Typography } from 'decentraland-ui2';
import { ChartsReferenceLine, LineChart } from '@mui/x-charts';

import type { TimeSeriesPoint } from '/shared/types/place-analytics';

import { t } from '/@/modules/store/translation/utils';

import {
  AXIS_TEXT_COLOR,
  CHART_HEIGHT,
  CHART_MARGIN,
  END_MARKER_RADIUS,
  REFERENCE_COLOR,
  SERIES_COLOR,
  chartSx,
} from './theme';

import './styles.css';

const tickDateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const tooltipDateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

type Props = {
  points: TimeSeriesPoint[];
  /** Names the series in the tooltip. The chart's own title is its label. */
  seriesName: string;
  formatValue: (value: number) => string;
  /** Upper bound of the y axis; the axis starts at 0. */
  maxValue?: number;
  /** Dashed benchmark drawn across the plot, e.g. the Day 7 target. */
  reference?: { value: number; label: string };
};

/**
 * The value at the end of the line, labelled directly instead of labelling
 * every point. Positioned from the chart's own scales so it tracks the data.
 */
function EndOfLineLabel({
  point,
  formatValue,
}: {
  point: TimeSeriesPoint;
  formatValue: Props['formatValue'];
}) {
  const xScale = useXScale();
  const yScale = useYScale();
  const { left, width, top, height } = useDrawingArea();

  if (point.value === null) return null;

  const x = (xScale as (value: Date) => number)(new Date(point.date));
  const y = (yScale as (value: number) => number)(point.value);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  // Keep the label inside the SVG even when the last point sits at an edge.
  const labelY = Math.min(Math.max(y, top + 8), top + height - 8);

  return (
    <g className="EndOfLineLabel">
      {/* 2px surface ring so the marker stays legible over the line. */}
      <circle
        cx={x}
        cy={y}
        r={END_MARKER_RADIUS}
        fill={SERIES_COLOR}
        stroke="var(--card)"
        strokeWidth={2}
      />
      <text
        x={Math.min(x + 12, left + width + 12)}
        y={labelY}
        dominantBaseline="middle"
        className="EndOfLineLabelText"
      >
        {formatValue(point.value)}
      </text>
    </g>
  );
}

export function TimeSeriesChart({ points, seriesName, formatValue, maxValue, reference }: Props) {
  if (points.length === 0) {
    return (
      <Box className="ChartEmpty">
        <Typography variant="body2">{t('analytics.detail.charts.no_data')}</Typography>
      </Box>
    );
  }

  const lastPoint = [...points].reverse().find(point => point.value !== null);

  /*
   * Explicit tick positions, one per fortnight. A time axis ignores a
   * tickInterval *function* (that form only applies to band/point scales) and
   * d3's own tick picking lands on every week, which crowds the axis.
   */
  const tickValues = points
    .filter((_point, index) => index % 2 === 0)
    .map(point => new Date(point.date));

  return (
    <LineChart
      height={CHART_HEIGHT}
      margin={CHART_MARGIN}
      sx={chartSx}
      grid={{ horizontal: true }}
      /*
       * The line draws itself in on mount, which leaves the end-of-line marker
       * and its label sitting away from a half-drawn line. A metrics panel
       * should just show its numbers.
       */
      skipAnimation
      xAxis={[
        {
          data: points.map(point => new Date(point.date)),
          scaleType: 'time',
          tickInterval: tickValues,
          valueFormatter: (date: Date, context) =>
            context.location === 'tooltip'
              ? tooltipDateFormat.format(date)
              : tickDateFormat.format(date),
        },
      ]}
      yAxis={[{ min: 0, max: maxValue, valueFormatter: (value: number) => formatValue(value) }]}
      series={[
        {
          data: points.map(point => point.value),
          label: seriesName,
          color: SERIES_COLOR,
          curve: 'linear',
          showMark: false,
          valueFormatter: (value: number | null) => (value === null ? '-' : formatValue(value)),
        },
      ]}
      slotProps={{ legend: { hidden: true } }}
    >
      {reference && (
        <ChartsReferenceLine
          y={reference.value}
          label={reference.label}
          labelAlign="end"
          lineStyle={{ stroke: REFERENCE_COLOR, strokeDasharray: '6 6' }}
          labelStyle={{ fill: AXIS_TEXT_COLOR, fontSize: 12, fontWeight: 600 }}
        />
      )}
      {lastPoint && (
        <EndOfLineLabel
          point={lastPoint}
          formatValue={formatValue}
        />
      )}
    </LineChart>
  );
}
