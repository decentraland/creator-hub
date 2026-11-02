import { useDrawingArea, useXScale, useYScale } from '@mui/x-charts/hooks';

import { END_MARKER_RADIUS } from './theme';

export type EndLabel = {
  key: string;
  /** Epoch milliseconds of the last point with a value. */
  date: number;
  value: number;
  color: string;
  text: string;
};

/** Vertical room a label needs before it starts touching its neighbour. */
const MIN_LABEL_GAP = 18;

/**
 * Labels the end of each line rather than every point.
 *
 * When two lines finish close together their labels would overlap. They are
 * pushed apart just enough to clear each other and a thin leader connects the
 * label back to its own line, so a nudged label never reads as belonging to
 * the wrong series.
 */
export function EndOfLineLabels({ labels }: { labels: EndLabel[] }) {
  const xScale = useXScale();
  const yScale = useYScale();
  const { left, width, top, height } = useDrawingArea();

  const positioned = labels
    .map(label => ({
      ...label,
      x: (xScale as (value: Date) => number)(new Date(label.date)),
      y: (yScale as (value: number) => number)(label.value),
    }))
    .filter(label => Number.isFinite(label.x) && Number.isFinite(label.y))
    .sort((a, b) => a.y - b.y);

  let lastLabelY = -Infinity;
  const laidOut = positioned.map(label => {
    const labelY = Math.max(label.y, lastLabelY + MIN_LABEL_GAP);
    lastLabelY = labelY;
    return {
      ...label,
      labelY: Math.min(Math.max(labelY, top + 8), top + height - 8),
    };
  });

  return (
    <g className="EndOfLineLabels">
      {laidOut.map(label => (
        <g key={label.key}>
          {Math.abs(label.labelY - label.y) > 1 && (
            <line
              x1={label.x + END_MARKER_RADIUS}
              y1={label.y}
              x2={label.x + 10}
              y2={label.labelY}
              stroke={label.color}
              strokeWidth={1}
              strokeOpacity={0.6}
            />
          )}
          {/* 2px surface ring so the marker stays legible over the line. */}
          <circle
            cx={label.x}
            cy={label.y}
            r={END_MARKER_RADIUS}
            fill={label.color}
            stroke="var(--card)"
            strokeWidth={2}
          />
          <text
            x={Math.min(label.x + 12, left + width + 12)}
            y={label.labelY}
            dominantBaseline="middle"
            className="EndOfLineLabelText"
          >
            {label.text}
          </text>
        </g>
      ))}
    </g>
  );
}
