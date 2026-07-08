import type { UiTransformProps } from '@dcl/react-ecs';
import { getContentUrl } from '../../constants';
import { COLORS, RADIUS, TYPE } from '../../theme';

const getErrorIcon = () => `${getContentUrl()}/admin_toolkit/assets/icons/error.png`;

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
    borderWidth: 1,
    borderRadius: RADIUS.sm,
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
  white: COLORS.textPrimary,
  black: COLORS.black,
  red: COLORS.danger,
  pink: COLORS.danger,
  inputBorder: COLORS.inputBorder,
});

export const getAddUserInputBackgrounds = () => ({
  input: { color: COLORS.inputBackground },
  errorIcon: {
    textureMode: 'stretch' as const,
    texture: {
      src: getErrorIcon(),
    },
  },
});

export const getBanUserTextStyles = () => ({
  fontSize: TYPE.body,
  color: COLORS.textSecondary,
  textAlign: 'top-left' as const,
});
