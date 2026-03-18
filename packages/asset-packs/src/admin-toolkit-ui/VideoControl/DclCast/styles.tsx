import { Color4 } from '@dcl/sdk/math';
import type { UiTransformProps } from '@dcl/react-ecs';
import { getContentUrl } from '../../constants';
import {
  getModalStyles,
  getModalBackgrounds,
  getModalColors,
  getPaginationColor,
} from '../../ModerationControl/styles/UsersListStyles';

export const getDclCastStyles = (): Record<string, UiTransformProps> => ({
  fullContainer: {
    flexDirection: 'column',
    width: '100%',
    height: '100%',
  },

  fullWidthWithBottomMargin: {
    width: '100%',
    margin: { bottom: 24 },
  },

  rowSpaceBetween: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  rowCenter: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },

  rowCenterSpaceBetween: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },

  columnContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    alignItems: 'flex-start',
  },

  columnFlexStart: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: 'auto',
  },

  columnCentered: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },

  columnWithMarginTop: {
    display: 'flex',
    flexDirection: 'column',
    margin: { top: 16 },
  },

  marginBottomSmall: {
    margin: { bottom: 8 },
  },

  marginTopSmall: {
    margin: { top: -4 },
  },

  marginRightSmall: {
    margin: { right: 4 },
  },

  mainBorderedContainer: {
    width: '100%',
    height: 'auto',
    borderWidth: 2,
    borderColor: Color4.fromHexString('#716B7C'),
    flexDirection: 'column',
    borderRadius: 12,
    padding: {
      left: 16,
      right: 16,
      top: 24,
      bottom: 8,
    },
  },

  headerRow: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    margin: { bottom: 18 },
  },

  activateButton: {
    minWidth: 120,
    height: 42,
    padding: { left: 8, right: 8 },
  },

  activateButtonLabel: {
    margin: { left: 20, right: 20 },
  },

  retryButton: {
    margin: { top: 16 },
    padding: {
      top: 8,
      bottom: 8,
      left: 16,
      right: 16,
    },
  },

  resetButton: {
    margin: { right: 8, top: 20 },
    padding: { left: 8, right: 8 },
    height: 42,
  },

  volumeShowcaseRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
  },

  castControlsRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    margin: { top: 12 },
  },

  showcaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: { left: 12, right: 12 },
    height: 42,
  },

  starIcon: {
    width: 20,
    height: 20,
    margin: { right: 4 },
  },

  copyLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: {
      top: 4,
      bottom: 4,
      left: 8,
      right: 8,
    },
  },

  iconSmall: {
    width: 20,
    height: 20,
  },

  headerIcon: {
    width: 30,
    height: 30,
  },

  chevronButton: {
    width: 25,
    height: 25,
    alignItems: 'center',
  },

  loadingContainer: {
    minHeight: 400,
  },

  separatorLine: {
    margin: { top: 16, bottom: 16 },
    width: '100%',
    height: 1,
    borderWidth: 1,
    borderColor: Color4.fromHexString('#43404A'),
  },

  textInfoContainer: {
    display: 'flex',
    flexDirection: 'column',
    margin: { bottom: 4 },
  },

  rowWithBottomMargin: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    margin: { bottom: 8 },
  },
});

export const getDclCastColors = () => ({
  white: Color4.White(),
  black: Color4.Black(),
  gray: Color4.fromHexString('#716B7C'),
  lightGray: Color4.fromHexString('#A09BA8'),
  success: Color4.fromHexString('#34CE77'),
  danger: Color4.fromHexString('#FB3B3B'),
  darkGray: Color4.Gray(),
});

export const getDclCastBackgrounds = () => ({
  success: { color: Color4.fromHexString('#34CE77') },
  iconStretch: {
    textureMode: 'stretch' as const,
  },
});

export const getCompactBarStyles = (): Record<string, UiTransformProps> => ({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },

  leftSection: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },

  rightSection: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },

  icon: {
    width: 30,
    height: 30,
    margin: { right: 10 },
  },

  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: { left: 12, right: 12 },
    height: 42,
  },

  controlButtonIcon: {
    width: 20,
    height: 20,
  },

  slideLabel: {
    margin: { left: 8, right: 8 },
  },

  showcaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: { left: 12, right: 12 },
    height: 42,
    margin: { left: 4 },
  },

  starIcon: {
    width: 20,
    height: 20,
    margin: { right: 4 },
  },

  outerContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },

  chevronButton: {
    width: 25,
    height: 25,
    alignItems: 'center',
    margin: { left: 8 },
  },

  presentationControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    margin: { top: 24 },
  },

  showcaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: { top: 24 },
  },

  activateButton: {
    minWidth: 120,
    height: 42,
    padding: { left: 8, right: 8 },
  },

  activateButtonLabel: {
    margin: { left: 20, right: 20 },
  },
});

// ── Speaker Showcase ───────────────────────────────────────────────────

export const SHOWCASE_DROPDOWN_COLORS = {
  idle: Color4.fromHexString('#716B7C'),
  hover: Color4.fromHexString('#FF2D55'),
  active: Color4.White(),
  hoverBg: Color4.fromHexString('#242129'),
  transparentBg: Color4.create(0, 0, 0, 0),
};

export const SHOWCASE_PAGE_INDICATOR_COLOR = Color4.fromHexString('#A09BA8');

export const getSpeakerShowcaseStyles = (): Record<string, UiTransformProps> => {
  const base = getModalStyles();
  return {
    ...base,
    userRow: { ...base.userRow, height: 36, margin: { top: 2, bottom: 2 } },
    personIcon: { ...base.personIcon, width: 20, height: 20 },
    personIconContainer: { ...base.personIconContainer, margin: { right: 8 } },
    pagination: { ...base.pagination, margin: { top: 12 }, padding: { left: 8, right: 8 } },
    starIcon: { width: 16, height: 16, margin: { right: 4 } },
    dropdownWrapper: { width: 200, height: 32 },
    dropdownTransform: { height: 32, width: 180, borderWidth: 0, borderColor: Color4.Clear() },
    rowCenter: { flexDirection: 'row', alignItems: 'center' },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      justifyContent: 'space-between',
      width: '100%',
      borderWidth: 1,
      borderColor: Color4.White(),
      borderRadius: 8,
      padding: 8,
      margin: { bottom: 12 },
    },
    toggleButton: {
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      padding: { left: 12, right: 12 },
    },
  };
};

export const getShowcaseColors = () => getModalColors();

// Cache texture backgrounds at module level so object references stay stable
// across re-renders — prevents the engine from re-downloading/re-processing images.
let _showcaseIconBackgrounds:
  | {
      showcase: { textureMode: 'stretch'; texture: { src: string } };
      star: { textureMode: 'stretch'; texture: { src: string } };
    }
  | undefined;

export function getShowcaseIconBackgrounds() {
  if (!_showcaseIconBackgrounds) {
    _showcaseIconBackgrounds = {
      showcase: {
        textureMode: 'stretch',
        texture: {
          src: `${getContentUrl()}/admin_toolkit/assets/icons/admin-panel-verified-user.png`,
        },
      },
      star: {
        textureMode: 'stretch',
        texture: { src: `${getContentUrl()}/admin_toolkit/assets/icons/star.png` },
      },
    };
  }
  return _showcaseIconBackgrounds;
}

export function getShowcaseBackgrounds() {
  return getModalBackgrounds();
}

export { getPaginationColor };
