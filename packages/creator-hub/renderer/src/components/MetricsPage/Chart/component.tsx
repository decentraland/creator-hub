import React, { useCallback, useMemo, useState } from 'react';
import type { ChartSeries } from '/@/modules/store/metrics';
import './styles.css';

const WIDTH = 720;
const HEIGHT = 260;
const PADDING = { top: 20, right: 16, bottom: 30, left: 52 };
const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

export type Props = {
  series: ChartSeries[];
  ariaLabel: string;
  unit?: '' | '%';
  yMax?: number;
  yStep?: number;
  legend?: boolean;
  area?: boolean;
  showDelta?: boolean;
};

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const unit = value / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10;
  return nice * power;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${Math.round((value / 1_000_000) * 10) / 10}M`;
  if (value >= 1000) return `${Math.round((value / 1000) * 10) / 10}K`;
  return `${Math.round(value)}`;
}

function formatDateLabel(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

const Chart: React.FC<Props> = ({
  series,
  ariaLabel,
  unit = '',
  yMax: yMaxProp,
  yStep: yStepProp,
  legend = false,
  area = false,
  showDelta = false,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const refPoints = useMemo(
    () =>
      series.reduce(
        (best, s) => (s.points.length > best.length ? s.points : best),
        [] as ChartSeries['points'],
      ),
    [series],
  );

  const valueMaps = useMemo(
    () => series.map(s => new Map(s.points.map(point => [point.date, point.value]))),
    [series],
  );

  const { yMax, yTicks } = useMemo(() => {
    if (yMaxProp !== undefined) {
      const step = yStepProp ?? yMaxProp;
      const ticks: number[] = [];
      for (let value = 0; value <= yMaxProp + 1e-9; value += step) ticks.push(value);
      return { yMax: yMaxProp, yTicks: ticks };
    }
    const maxValue = series.reduce(
      (max, s) => s.points.reduce((acc, point) => Math.max(acc, point.value ?? 0), max),
      0,
    );
    const step = niceCeil(maxValue / 3);
    const top = step * 3;
    return { yMax: top, yTicks: [0, step, step * 2, top] };
  }, [series, yMaxProp, yStepProp]);

  const xAt = useCallback(
    (index: number) =>
      PADDING.left +
      (refPoints.length > 1 ? (index * PLOT_WIDTH) / (refPoints.length - 1) : PLOT_WIDTH / 2),
    [refPoints.length],
  );
  const yAt = useCallback(
    (value: number) => PADDING.top + PLOT_HEIGHT - (value / yMax) * PLOT_HEIGHT,
    [yMax],
  );

  const paths = useMemo(
    () =>
      series.map((_series, seriesIndex) => {
        const segments: string[] = [];
        let current: string[] = [];
        refPoints.forEach((ref, index) => {
          const value = valueMaps[seriesIndex].get(ref.date) ?? null;
          if (value === null) {
            if (current.length) {
              segments.push(current.join(' '));
              current = [];
            }
            return;
          }
          current.push(
            `${current.length ? 'L' : 'M'}${xAt(index).toFixed(2)},${yAt(value).toFixed(2)}`,
          );
        });
        if (current.length) segments.push(current.join(' '));
        return segments;
      }),
    [series, refPoints, valueMaps, xAt, yAt],
  );

  const areaPath = useMemo(() => {
    if (!area || series.length !== 1 || refPoints.length < 2) return null;
    const map = valueMaps[0];
    const filled = refPoints.filter(ref => map.get(ref.date) != null);
    if (filled.length < 2) return null;
    const baseline = PADDING.top + PLOT_HEIGHT;
    const line = refPoints
      .map((ref, index) => {
        const value = map.get(ref.date);
        return value == null ? null : { index, value };
      })
      .filter((p): p is { index: number; value: number } => p !== null)
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(p.index).toFixed(2)},${yAt(p.value).toFixed(2)}`)
      .join(' ');
    const first = refPoints.findIndex(ref => map.get(ref.date) != null);
    const last =
      refPoints.length - 1 - [...refPoints].reverse().findIndex(ref => map.get(ref.date) != null);
    return `${line} L${xAt(last).toFixed(2)},${baseline} L${xAt(first).toFixed(2)},${baseline} Z`;
  }, [area, series.length, refPoints, valueMaps, xAt, yAt]);

  const xTickIndexes = useMemo(() => {
    if (refPoints.length === 0) return [];
    const step = Math.max(1, Math.ceil((refPoints.length - 1) / 6));
    const indexes = [];
    for (let i = 0; i < refPoints.length; i += step) indexes.push(i);
    if (indexes[indexes.length - 1] !== refPoints.length - 1) indexes.push(refPoints.length - 1);
    return indexes;
  }, [refPoints.length]);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (refPoints.length === 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (!rect.width) return;
      const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
      const ratio = (x - PADDING.left) / PLOT_WIDTH;
      const index = Math.round(ratio * (refPoints.length - 1));
      setHoverIndex(Math.min(refPoints.length - 1, Math.max(0, index)));
    },
    [refPoints.length],
  );

  const handlePointerLeave = useCallback(() => setHoverIndex(null), []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      if (refPoints.length === 0) return;
      if (event.key === 'Escape') {
        setHoverIndex(null);
        return;
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const delta = event.key === 'ArrowLeft' ? -1 : 1;
      setHoverIndex(current =>
        current === null
          ? refPoints.length - 1
          : Math.min(refPoints.length - 1, Math.max(0, current + delta)),
      );
    },
    [refPoints.length],
  );

  const formatTick = useCallback((value: number) => `${formatCount(value)}${unit}`, [unit]);

  const tooltip = useMemo(() => {
    if (hoverIndex === null || !refPoints[hoverIndex]) return null;
    const ref = refPoints[hoverIndex];
    const lines = [formatDateLabel(ref.date)];
    series.forEach((s, i) => {
      const value = valueMaps[i].get(ref.date) ?? null;
      if (value === null) return;
      const shown = `${formatCount(value)}${unit}`;
      let deltaStr = '';
      if (showDelta) {
        const prev =
          hoverIndex > 0 ? (valueMaps[i].get(refPoints[hoverIndex - 1].date) ?? null) : null;
        if (prev !== null) {
          const diff = Math.round((value - prev) * 10) / 10;
          deltaStr = ` ${diff >= 0 ? '+' : ''}${diff}${unit}`;
        }
      }
      lines.push(`${s.label} ${shown}${deltaStr}`);
    });
    const width = Math.max(...lines.map(line => line.length)) * 6.5 + 16;
    const height = lines.length * 15 + 12;
    const pointX = xAt(hoverIndex);
    const x = pointX + 12 + width > WIDTH - PADDING.right ? pointX - 12 - width : pointX + 12;
    const y = Math.max(PADDING.top, Math.min(PADDING.top + 8, PADDING.top + PLOT_HEIGHT - height));
    return { lines, width, height, x, y };
  }, [hoverIndex, refPoints, series, valueMaps, unit, showDelta, xAt]);

  return (
    <div className="MetricsChart">
      {legend && (
        <div className="chart-legend">
          {series.map(s => (
            <span
              key={s.key}
              className="legend-chip"
            >
              <span
                className="legend-swatch"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
      >
        {yTicks.map(value => {
          const y = yAt(value);
          return (
            <g key={value}>
              <line
                className="grid-line"
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={y}
                y2={y}
              />
              <text
                className="axis-text"
                x={PADDING.left - 8}
                y={y + 4}
                textAnchor="end"
              >
                {formatTick(value)}
              </text>
            </g>
          );
        })}
        {xTickIndexes.map(index => (
          <text
            key={refPoints[index].date}
            className="axis-text"
            x={xAt(index)}
            y={HEIGHT - PADDING.bottom + 18}
            textAnchor="middle"
          >
            {formatDateLabel(refPoints[index].date)}
          </text>
        ))}
        {areaPath && (
          <path
            className="series-area"
            d={areaPath}
          />
        )}
        {paths.map((segments, seriesIndex) =>
          segments.map((d, segmentIndex) => (
            <path
              key={`${series[seriesIndex].key}-${segmentIndex}`}
              className="series-line"
              d={d}
              style={{ stroke: series[seriesIndex].color }}
            />
          )),
        )}
        {hoverIndex !== null && refPoints[hoverIndex] && (
          <g className="hover-layer">
            <line
              className="crosshair"
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={PADDING.top}
              y2={PADDING.top + PLOT_HEIGHT}
            />
            {series.map((s, i) => {
              const value = valueMaps[i].get(refPoints[hoverIndex].date) ?? null;
              return value === null ? null : (
                <circle
                  key={s.key}
                  className="hover-dot"
                  cx={xAt(hoverIndex)}
                  cy={yAt(value)}
                  r={4}
                  style={{ fill: s.color }}
                />
              );
            })}
            {tooltip && (
              <g className="tooltip">
                <rect
                  className="tooltip-box"
                  x={tooltip.x}
                  y={tooltip.y}
                  width={tooltip.width}
                  height={tooltip.height}
                  rx={4}
                />
                {tooltip.lines.map((line, index) => (
                  <text
                    key={line}
                    className={index === 0 ? 'tooltip-value' : 'tooltip-text'}
                    x={tooltip.x + 8}
                    y={tooltip.y + 16 + index * 15}
                  >
                    {line}
                  </text>
                ))}
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
};

export { Chart };
