import type { IEngine } from '@dcl/ecs';
import type { UiTransformProps } from '@dcl/react-ecs';
import ReactEcs, { UiEntity } from '@dcl/react-ecs';
import { clearInterval, setInterval } from './utils';
import { COLORS } from './theme';

interface LoadingProps {
  engine: IEngine;
  width?: number;
  height?: number;
  uiTransform?: UiTransformProps;
}

export function LoadingDots({ uiTransform, engine, width = 10, height = 10 }: LoadingProps) {
  let __frame = 0;
  const [frame, setFrame] = ReactEcs.useState(0);

  ReactEcs.useEffect(() => {
    const interval = setInterval(
      engine,
      () => {
        __frame = (__frame + 1) % 4;
        setFrame(__frame);
      },
      340,
    );
    return () => clearInterval(engine, interval);
  }, []);

  return (
    <UiEntity
      uiTransform={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        ...uiTransform,
      }}
    >
      {[1, 2, 3].map(i => (
        <UiEntity
          key={`dot-${i}`}
          uiTransform={{
            width,
            height,
            borderRadius: width / 2,
            margin: { right: 8 },
          }}
          uiBackground={{
            color: frame >= i ? COLORS.primary : COLORS.borderSubtle,
          }}
        />
      ))}
    </UiEntity>
  );
}
