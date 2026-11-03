/**
 * Shared chart palette and chrome.
 *
 * The colors are validated against the inner panel surface (#141316) for
 * lightness band, chroma, colorblind separation and contrast. Re-run the check
 * before adding or changing any series color:
 *
 *   node scripts/validate_palette.js "#ff2d55,#a99afe" --mode dark --surface "#141316"
 */

/** Tooltip swatch and the series color x-charts requires; the drawn stroke is the gradient. */
export const SERIES_COLOR = '#ff2d55';

/** Benchmark and threshold lines. Reads apart from the series under every CVD type. */
export const REFERENCE_COLOR = 'var(--chart-reference)';

/** Y-axis room above a benchmark line, so its label clears the plot's top edge. */
export const REFERENCE_HEADROOM = 1.25;

/**
 * Categorical hues for multi-series charts, in fixed order — a series keeps its
 * color wherever it appears, and the order is never cycled for a new series.
 * Validated all-pairs (worst CVD ΔE 9.6, normal vision 21.1):
 *
 *   node scripts/validate_palette.js "#6690f0,#17a06f,#c9761f" \
 *     --mode dark --surface "#141316" --pairs all
 */
export const CATEGORICAL_COLORS = ['#6690f0', '#17a06f', '#c9761f'];

export const GRID_COLOR = 'var(--palette-whiteTransparent-soft)';
export const AXIS_TEXT_COLOR = 'var(--dcl-silver)';
export const LABEL_COLOR = 'var(--palette-neutral-softWhite)';

export const LINE_WIDTH = 2;
export const END_MARKER_RADIUS = 6;

export const CHART_HEIGHT = 351;

export const CHART_MARGIN = { left: 51, right: 40, top: 9, bottom: 26 };

/** Series ids for a line split into final cohorts and the still-settling tail drawn dotted after them. */
export const FINAL_SERIES_ID = 'final';
export const SETTLING_SERIES_ID = 'settling';

/** Paint for a single series: its gradient when it has one, else the flat series color. */
export const seriesPaint = (gradientId?: string) =>
  gradientId ? `url(#${gradientId})` : SERIES_COLOR;

/**
 * Axes and grid stay recessive so the data is the only loud thing; the series
 * paint is set per series, never on text.
 */
export const chartSx = (gradientId?: string) => ({
  '& .MuiChartsAxis-tickLabel': {
    fill: `${AXIS_TEXT_COLOR} !important`,
    fontSize: 14,
    fontWeight: 400,
  },
  '& .MuiChartsGrid-line': { stroke: GRID_COLOR, strokeWidth: 1 },
  '& .MuiLineElement-root': {
    strokeWidth: LINE_WIDTH,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...(gradientId && { stroke: seriesPaint(gradientId) }),
  },
  '& .MuiHighlightElement-root': {
    r: END_MARKER_RADIUS,
    stroke: 'var(--black)',
    strokeWidth: 2,
    ...(gradientId && { fill: seriesPaint(gradientId) }),
  },
  [`& .MuiLineElement-series-${SETTLING_SERIES_ID}`]: { strokeDasharray: '0 6' },
  [`& .MuiHighlightElement-series-${SETTLING_SERIES_ID}`]: {
    fill: 'var(--black)',
    ...(gradientId && { stroke: seriesPaint(gradientId) }),
  },
});

export const yAxisChrome = { disableLine: true, disableTicks: true, tickNumber: 5, tickSize: 10 };
export const xAxisChrome = { disableLine: true, disableTicks: true };

/** Axis ticks read "Mar 16"; tooltips spell the year out. */
export const tickDateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
export const tooltipDateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** One tick per fortnight, as explicit dates: a time axis ignores a `tickInterval` function. */
export const fortnightlyTicks = (dates: number[]) =>
  dates.filter((_date, index) => index % 2 === 0).map(date => new Date(date));

/** Explicit quarters for a full 0-100 percentage axis, where `tickNumber` is only a hint; data-sized axes keep the chart's own. */
export const percentTicks = (maxValue?: number) =>
  maxValue === 100 ? [0, 25, 50, 75, 100] : undefined;
