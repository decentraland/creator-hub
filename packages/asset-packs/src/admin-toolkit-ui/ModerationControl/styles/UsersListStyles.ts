import { Color4 } from '@dcl/ecs-math';
import type { UiTransformProps } from '@dcl/react-ecs';
import { CONTENT_URL } from '../../constants';

const ICONS = {
  VERIFIED_USER: `${CONTENT_URL}/admin_toolkit/assets/icons/admin-panel-verified-user.png`,
  PERSON: `${CONTENT_URL}/admin_toolkit/assets/icons/person-outline.png`,
  BAN: `${CONTENT_URL}/admin_toolkit/assets/icons/ban.png`,
};

export const getModalStyles = (scaleFactor: number): Record<string, UiTransformProps> => ({
  overlay: {
    width: '100%',
    height: '100%',
    positionType: 'absolute',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  container: {
    width: 675 * scaleFactor,
    maxHeight: 679 * scaleFactor,
    minHeight: 479 * scaleFactor,
    padding: 20 * scaleFactor,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderRadius: 12 * scaleFactor,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
  },
  header: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    margin: { bottom: 24 * scaleFactor },
  },
  headerIcon: {
    width: 30 * scaleFactor,
    height: 30 * scaleFactor,
    margin: { right: 10 * scaleFactor },
  },
  usersCount: {
    margin: { left: 8 * scaleFactor },
  },
  closeButton: {
    position: { right: 0 },
    positionType: 'absolute',
    borderColor: Color4.Clear(),
  },
  closeIcon: {
    width: 32 * scaleFactor,
    height: 32 * scaleFactor,
  },
  listContainer: {
    flexDirection: 'column',
    width: '100%',
    margin: { top: 16 * scaleFactor },
  },
  userItem: {
    display: 'flex',
    flexDirection: 'column',
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48 * scaleFactor,
    padding: { left: 8 * scaleFactor, right: 8 * scaleFactor },
    margin: { top: 4 * scaleFactor, bottom: 4 * scaleFactor },
  },
  userInfo: {
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
  },
  personIconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: { right: 10 * scaleFactor },
  },
  personIcon: {
    width: 28 * scaleFactor,
    height: 28 * scaleFactor,
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  nameContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  verifiedIcon: {
    width: 14 * scaleFactor,
    height: 14 * scaleFactor,
  },
  roleBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'auto',
    height: 20 * scaleFactor,
    padding: {
      left: 4 * scaleFactor,
    },
    margin: { left: 8 * scaleFactor },
    borderRadius: 4 * scaleFactor,
  },
  removeButton: {
    margin: {
      left: 10 * scaleFactor,
      right: 10 * scaleFactor,
    },
  },
  divider: {
    width: '100%',
    height: 1,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: { top: 20 * scaleFactor },
    padding: { left: 10 * scaleFactor, right: 10 * scaleFactor },
  },
  paginationButton: {
    height: 42 * scaleFactor,
    alignItems: 'center',
  },
  prevIcon: {
    width: 25 * scaleFactor,
    height: 25 * scaleFactor,
    margin: { left: 8 * scaleFactor },
  },
  prevLabel: {
    margin: { right: 10 * scaleFactor },
  },
  nextIcon: {
    width: 25 * scaleFactor,
    height: 25 * scaleFactor,
    margin: { right: 8 * scaleFactor },
  },
  nextLabel: {
    margin: { left: 10 * scaleFactor },
  },
  messageContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    margin: { top: 16 * scaleFactor },
  },
  messageLabel: {
    padding: {
      top: 8 * scaleFactor,
      bottom: 8 * scaleFactor,
      left: 16 * scaleFactor,
      right: 16 * scaleFactor,
    },
  },
});

export const getModalBackgrounds = () => ({
  container: { color: Color4.Black() },
  divider: { color: Color4.fromHexString('#43404A') },
  roleBadge: { color: Color4.fromHexString('#A09BA8') },
  headerIcon: {
    textureMode: 'stretch' as const,
    texture: {
      src: ICONS.VERIFIED_USER,
    },
  },
  personIcon: {
    textureMode: 'stretch' as const,
    texture: {
      src: ICONS.PERSON,
    },
  },
  banIcon: {
    textureMode: 'stretch' as const,
    texture: {
      src: ICONS.BAN,
    },
  },
  verifiedIcon: {
    textureMode: 'stretch' as const,
    texture: {
      src: ICONS.VERIFIED_USER,
    },
    color: Color4.White(),
  },
});

export const getModalColors = () => ({
  white: Color4.White(),
  gray: Color4.Gray(),
  addressGray: Color4.fromHexString('#716B7C'),
  removeRed: Color4.fromHexString('#FF2D55FF'),
  disabledGray: Color4.fromHexString('#323232'),
  black: Color4.Black(),
});

export const getPaginationColor = (isDisabled: boolean) => {
  const colors = getModalColors();
  return isDisabled ? colors.disabledGray : colors.white;
};
