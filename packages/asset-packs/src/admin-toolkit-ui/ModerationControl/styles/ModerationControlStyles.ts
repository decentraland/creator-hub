import { Color4 } from '@dcl/ecs-math';
import type { UiTransformProps } from '@dcl/react-ecs';

export const getModerationControlStyles = (): Record<string, UiTransformProps> => ({
  container: {
    width: '100%',
    height: '100%',
    flexDirection: 'column',
  },
  viewListButton: {
    width: 220,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    margin: { top: 16 },
  },
  viewListIcon: {
    width: 25,
    height: 25,
    margin: { right: 10 },
  },
  divider: {
    margin: { top: 16, bottom: 16 },
    width: '100%',
    height: 1,
    borderWidth: 1,
    borderColor: Color4.fromHexString('#43404A'),
  },
});

export const getModerationControlColors = () => ({
  white: Color4.White(),
});
