/**
 * Shared chart palette and chrome.
 *
 * The colors are validated against the card surface (#242129) for lightness
 * band, chroma, colorblind separation and contrast. Re-run the check before
 * adding or changing any series color:
 *
 *   node scripts/validate_palette.js "#ff2d55,#7a7aff" --mode dark --surface "#242129"
 */

/** Single-series lines. The brand pink, same as `--dcl`. */
export const SERIES_COLOR = '#ff2d55';

/** Benchmark and threshold lines. Reads apart from the series under every CVD type. */
export const REFERENCE_COLOR = '#7a7aff';

/**
 * Categorical hues for multi-series charts, in fixed order — a series keeps its
 * color wherever it appears, and the order is never cycled for a new series.
 * Validated all-pairs (worst CVD ΔE 9.6, normal vision 21.1):
 *
 *   node scripts/validate_palette.js "#6690f0,#17a06f,#c9761f" \
 *     --mode dark --surface "#242129" --pairs all
 */
export const CATEGORICAL_COLORS = ['#6690f0', '#17a06f', '#c9761f'];

/** Recessive chrome, one step off the surface. */
export const GRID_COLOR = '#43404a';
export const AXIS_TEXT_COLOR = '#9b97a3';

/** Line and marker specs: 2px stroke, markers big enough to hover. */
export const LINE_WIDTH = 2;
export const END_MARKER_RADIUS = 4.5;

export const CHART_HEIGHT = 320;

/** Leaves room on the right for the end-of-line label. */
export const CHART_MARGIN = { left: 56, right: 84, top: 24, bottom: 40 };

/**
 * For charts sharing a row. The full-width margins would eat a third of a
 * half-width chart, so these are trimmed — but the left side still has to fit
 * the widest tick label ("30 min"), which clips at anything under ~56px.
 */
export const COMPACT_CHART_MARGIN = { left: 58, right: 60, top: 16, bottom: 40 };

/**
 * Axes and grid stay recessive so the data is the only loud thing; the series
 * color is set per series, never on text.
 */
export const chartSx = {
  '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: GRID_COLOR },
  '& .MuiChartsAxis-tickLabel': { fill: `${AXIS_TEXT_COLOR} !important`, fontSize: 12 },
  '& .MuiChartsGrid-line': { stroke: GRID_COLOR, strokeOpacity: 0.5 },
  '& .MuiLineElement-root': {
    strokeWidth: LINE_WIDTH,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
};

/** Axis ticks read "Mar 16"; tooltips spell the year out. */
export const tickDateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
export const tooltipDateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
