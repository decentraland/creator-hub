import { IEngine } from '@dcl/ecs';
import { Color4 } from '@dcl/ecs-math';
import ReactEcs, { Label, UiEntity, UiTransformProps } from '@dcl/react-ecs';
import { clearInterval, setInterval } from './utils';
import { COLORS } from './VideoControl';

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
          color: _frame === 1 ? COLORS.SUCCESS : Color4.fromHexString('#43404A'),
        }}
      />
      <Label
        value="<b>Active</b>"
        color={COLORS.SUCCESS}
        fontSize={16}
      />
    </UiEntity>
  );
}
