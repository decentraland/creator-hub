import ReactEcs, { UiEntity, UiTransformProps } from '@dcl/react-ecs';
import { containerBackgroundColor } from '.';

export function Card({
  children,
  uiTransform,
}: {
  children?: ReactEcs.JSX.Element;
  uiTransform?: UiTransformProps;
}) {
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        borderRadius: 12,
        margin: {
          top: 10,
          right: 0,
          bottom: 0,
          left: 0,
        },
        padding: {
          top: 32,
          right: 32,
          bottom: 32,
          left: 32,
        },
        ...uiTransform,
      }}
      uiBackground={{ color: containerBackgroundColor }}
    >
      {children}
    </UiEntity>
  );
}
