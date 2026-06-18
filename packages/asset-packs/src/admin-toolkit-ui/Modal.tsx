// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import ReactEcs, {
  UiEntity,
  Label,
  type UiBackgroundProps,
  type UiTransformProps,
} from '@dcl/react-ecs';
import { getContentUrl } from './constants';
import { Button } from './Button';
import {
  getModalStyles,
  getModalColors,
  getModalBackgrounds,
} from './ModerationControl/styles/UsersListStyles';

const ICONS = {
  get CLOSE() {
    return `${getContentUrl()}/admin_toolkit/assets/icons/close.png`;
  },
};

type ModalProps = {
  id: string;
  title: string;
  onClose: () => void;
  children?: ReactEcs.JSX.Element;
  footer?: ReactEcs.JSX.Element;
  titleFontSize?: number;
  headerIcon?: UiBackgroundProps;
  headerIconSize?: number;
  headerMarginBottom?: number;
  counterText?: string;
  counterFontSize?: number;
  width?: number;
  height?: number;
  padding?: number;
};

export function Modal({
  id,
  title,
  onClose,
  children,
  footer,
  titleFontSize = 24,
  headerIcon,
  headerIconSize,
  headerMarginBottom,
  counterText,
  counterFontSize = 16,
  width,
  height,
  padding,
}: ModalProps) {
  const styles = getModalStyles();
  const colors = getModalColors();
  const backgrounds = getModalBackgrounds();

  const containerStyle: UiTransformProps = {
    ...styles.container,
    ...(width !== undefined && { width }),
    ...(height !== undefined && { height }),
    ...(padding !== undefined && { padding }),
  };

  const headerIconStyle: UiTransformProps | undefined =
    headerIconSize !== undefined
      ? { ...styles.headerIcon, width: headerIconSize, height: headerIconSize }
      : styles.headerIcon;

  const headerStyle: UiTransformProps =
    headerMarginBottom !== undefined
      ? { ...styles.header, margin: { bottom: headerMarginBottom } }
      : styles.header;

  return (
    <UiEntity uiTransform={styles.overlay}>
      <UiEntity
        uiTransform={containerStyle}
        uiBackground={backgrounds.container}
      >
        <UiEntity uiTransform={styles.content}>
          <UiEntity uiTransform={headerStyle}>
            {headerIcon && (
              <UiEntity
                uiTransform={headerIconStyle}
                uiBackground={headerIcon}
              />
            )}
            <Label
              value={`<b>${title}</b>`}
              fontSize={titleFontSize}
              color={colors.white}
            />
            {counterText && (
              <Label
                value={counterText}
                fontSize={counterFontSize}
                color={colors.gray}
                uiTransform={styles.usersCount}
              />
            )}
            <Button
              id={`close-${id}-modal`}
              onlyIcon
              icon={ICONS.CLOSE}
              variant="secondary"
              fontSize={20}
              uiTransform={styles.closeButton}
              iconTransform={styles.closeIcon}
              onMouseDown={onClose}
            />
          </UiEntity>
          {children}
        </UiEntity>
        {footer}
      </UiEntity>
    </UiEntity>
  );
}
