import { Color4 } from '@dcl/ecs-math';
import type { UiTransformProps } from '@dcl/react-ecs';
import { getContentUrl } from '../../constants';

const ICONS = {
  get VERIFIED_USER() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/admin-panel-verified-user.png`;
  },
  get PERSON() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/person-outline.png`;
  },
  get BAN() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/ban.png`;
  },
};

export const getModalStyles = (): Record<string, UiTransformProps> => ({
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
    width: 675,
    maxHeight: 679,
    minHeight: 479,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderRadius: 12,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
  },
  header: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    margin: { bottom: 24 },
  },
  headerIcon: {
    width: 30,
    height: 30,
    margin: { right: 10 },
  },
  usersCount: {
    margin: { left: 8 },
  },
  closeButton: {
    position: { right: 0 },
    positionType: 'absolute',
    borderColor: Color4.Clear(),
  },
  closeIcon: {
    width: 32,
    height: 32,
  },
  listContainer: {
    flexDirection: 'column',
    width: '100%',
    margin: { top: 16 },
  },
  userItem: {
    display: 'flex',
    flexDirection: 'column',
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 48,
    padding: { left: 8, right: 8 },
    margin: { top: 4, bottom: 4 },
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
    margin: { right: 10 },
  },
  personIcon: {
    width: 28,
    height: 28,
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
    width: 14,
    height: 14,
  },
  roleBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'auto',
    height: 20,
    padding: {
      left: 4,
    },
    margin: { left: 8 },
    borderRadius: 4,
  },
  removeButton: {
    margin: {
      left: 10,
      right: 10,
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
    margin: { top: 20 },
    padding: { left: 10, right: 10 },
  },
  paginationButton: {
    height: 42,
    alignItems: 'center',
  },
  prevIcon: {
    width: 25,
    height: 25,
    margin: { left: 8 },
  },
  prevLabel: {
    margin: { right: 10 },
  },
  nextIcon: {
    width: 25,
    height: 25,
    margin: { right: 8 },
  },
  nextLabel: {
    margin: { left: 10 },
  },
  messageContainer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    margin: { top: 16 },
  },
  messageLabel: {
    padding: {
      top: 8,
      bottom: 8,
      left: 16,
      right: 16,
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
  softBlack: Color4.fromHexString('#161518'),
  transparent: Color4.create(0, 0, 0, 0),
});

export const getPaginationColor = (isDisabled: boolean) => {
  const colors = getModalColors();
  return isDisabled ? colors.disabledGray : colors.white;
};
