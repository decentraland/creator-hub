import { Color4 } from '@dcl/sdk/math';
import type { UiTransformProps } from '@dcl/react-ecs';

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
    margin: { top: 8 },
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
    height: '100%',
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    margin: { top: 12 },
  },

  showcaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: { left: 12, right: 12 },
    height: 42,
    borderWidth: 2,
    borderColor: Color4.fromHexString('#FCFCFC'),
    borderRadius: 12,
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
