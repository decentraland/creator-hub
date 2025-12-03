import { Color4 } from '@dcl/ecs-math';
import type { UiTransformProps } from '@dcl/react-ecs';

export const getModerationControlStyles = (
  scaleFactor: number,
): Record<string, UiTransformProps> => ({
  container: {
    width: '100%',
    height: '100%',
    flexDirection: 'column',
  },
  viewListButton: {
    width: 220 * scaleFactor,
    height: 42 * scaleFactor,
    alignItems: 'center',
    justifyContent: 'center',
    margin: { top: 16 * scaleFactor },
  },
  viewListIcon: {
    width: 25 * scaleFactor,
    height: 25 * scaleFactor,
    margin: { right: 10 * scaleFactor },
  },
  divider: {
    margin: { top: 16 * scaleFactor, bottom: 16 * scaleFactor },
    width: '100%',
    height: 1,
    borderWidth: 1,
    borderColor: Color4.fromHexString('#43404A'),
  },
});

export const getModerationControlColors = () => ({
  white: Color4.White(),
});
