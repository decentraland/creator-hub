import { Color4 } from '@dcl/ecs-math';
import type { UiTransformProps } from '@dcl/react-ecs';
import { CONTENT_URL } from '../../constants';

const ERROR_ICON = `${CONTENT_URL}/admin_toolkit/assets/icons/error.png`;

export const getAddUserInputStyles = (): Record<string, UiTransformProps> => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    margin: { bottom: 8 },
  },
  title: {
    margin: { bottom: 8 },
  },
  input: {
    width: '100%',
    borderWidth: 4,
    borderRadius: 8,
    height: 48,
  },
  button: {
    margin: { left: 10 },
    minWidth: 96,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  errorContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: 'auto',
    margin: { top: 4 },
  },
  errorIcon: {
    width: 16,
    height: 16,
    margin: { right: 8 },
  },
  bannedInfoContainer: {
    display: 'flex',
    flexDirection: 'column',
    margin: { bottom: 8 },
    padding: {
      top: 4,
      bottom: 8,
    },
  },
  marginBottomMedium: {
    margin: { bottom: 4 },
  },
});

export const getAddUserInputColors = () => ({
  white: Color4.White(),
  black: Color4.Black(),
  red: Color4.Red(),
  pink: Color4.fromHexString('#FB3B3B'),
});

export const getAddUserInputBackgrounds = () => ({
  input: { color: Color4.White() },
  errorIcon: {
    textureMode: 'stretch' as const,
    texture: {
      src: ERROR_ICON,
    },
  },
});

export const getBanUserTextStyles = () => ({
  fontSize: 14,
  color: Color4.White(),
  textAlign: 'top-left' as const,
});
