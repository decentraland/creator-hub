import { useDrawingArea, useYScale } from '@mui/x-charts/hooks';

type Props = {
  id: string;
  values: Array<number | null>;
};

/** Brand-to-lavender paint for one series, from its highest to its lowest point, in user space. */
export function SeriesGradient({ id, values }: Props) {
  const yScale = useYScale() as (value: number) => number;
  const { top, height } = useDrawingArea();
  const present = values.filter((value): value is number => value !== null);
  const max = Math.max(...present);
  const min = Math.min(...present);
  const [y1, y2] = max === min ? [top, top + height] : [yScale(max), yScale(min)];

  return (
    <defs>
      <linearGradient
        id={id}
        gradientUnits="userSpaceOnUse"
        x1={0}
        x2={0}
        y1={y1}
        y2={y2}
      >
        <stop
          offset={0}
          style={{ stopColor: 'var(--primary)' }}
        />
        <stop
          offset={1}
          style={{ stopColor: 'var(--lavender)' }}
        />
      </linearGradient>
    </defs>
  );
}
