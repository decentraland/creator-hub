// eslint-disable-next-line @typescript-eslint/consistent-type-imports, @typescript-eslint/no-unused-vars -- ReactEcs is the JSX factory
import ReactEcs, { UiEntity, type UiTransformProps } from '@dcl/react-ecs';
import { COLORS, RADIUS, SPACING } from './theme';

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
        borderRadius: RADIUS.lg,
        margin: {
          top: SPACING.sm,
          right: 0,
          bottom: 0,
          left: 0,
        },
        padding: {
          top: SPACING.xl,
          right: SPACING.xl,
          bottom: SPACING.xl,
          left: SPACING.xl,
        },
        ...uiTransform,
      }}
      uiBackground={{ color: COLORS.panel }}
    >
      {children}
    </UiEntity>
  );
}
