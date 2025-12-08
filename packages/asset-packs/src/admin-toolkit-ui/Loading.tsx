import { IEngine, UiTransform } from '@dcl/ecs';
import { Color4 } from '@dcl/ecs-math';
import ReactEcs, { UiEntity, UiTransformProps } from '@dcl/react-ecs';
import { clearInterval, setInterval } from './utils';

interface LoadingProps {
  scaleFactor: number;
  engine: IEngine;
  width?: number;
  height?: number;
  uiTransform?: UiTransformProps;
}

export function LoadingDots({
  scaleFactor,
  uiTransform,
  engine,
  width = 10,
  height = 10,
}: LoadingProps) {
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
            width: width * scaleFactor,
            height: height * scaleFactor,
            borderRadius: (width / 2) * scaleFactor,
            margin: { right: 8 * scaleFactor },
          }}
          uiBackground={{
            color: frame >= i ? Color4.fromHexString('#FF2D55') : Color4.fromHexString('#43404A'),
          }}
        />
      ))}
    </UiEntity>
  );
}
