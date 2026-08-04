import type { IEngine } from '@dcl/ecs';
import type { UiTransformProps } from '@dcl/react-ecs';
import ReactEcs, { Label, UiEntity } from '@dcl/react-ecs';
import { clearInterval, setInterval } from './utils';
import { COLORS, TYPE } from './theme';

interface LoadingProps {
  engine: IEngine;
  width?: number;
  height?: number;
  uiTransform?: UiTransformProps;
}

export function Active({ engine, width = 8, height = 8, uiTransform }: LoadingProps) {
  let frame = 0;
  const [_frame, setFrame] = ReactEcs.useState(0);

  ReactEcs.useEffect(() => {
    const interval = setInterval(
      engine,
      () => {
        frame = (frame + 1) % 2;
        setFrame(frame);
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
      <UiEntity
        uiTransform={{
          width,
          height,
          borderRadius: width / 2,
          margin: { right: 8 },
        }}
        uiBackground={{
          color: _frame === 1 ? COLORS.success : COLORS.borderSubtle,
        }}
      />
      <Label
        value="<b>Active</b>"
        color={COLORS.success}
        fontSize={TYPE.label}
      />
    </UiEntity>
  );
}
