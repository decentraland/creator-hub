import ReactEcs, {
  UiEntity,
  Label,
  type UiButtonProps,
  type UiTransformProps,
  type UiBackgroundProps,
} from '@dcl/react-ecs';
import { type Color4 } from '@dcl/sdk/math';
import { COLORS, RADIUS, TYPE } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger' | 'success';

type VariantStateColors = {
  active: Color4;
  hover: Color4;
  disabled: Color4;
};

// Hover feedback is a white outline stroke around the button — the fill is
// unchanged; only the border turns white on hover.
export const BTN_BACKGROUND_COLOR: Record<ButtonVariant, VariantStateColors> = {
  primary: {
    active: COLORS.primary,
    hover: COLORS.primary,
    disabled: COLORS.disabledBackground,
  },
  secondary: {
    active: COLORS.transparent,
    hover: COLORS.transparent,
    disabled: COLORS.transparent,
  },
  text: {
    active: COLORS.transparent,
    hover: COLORS.transparent,
    disabled: COLORS.transparent,
  },
  danger: {
    active: COLORS.danger,
    hover: COLORS.danger,
    disabled: COLORS.disabledBackground,
  },
  success: {
    active: COLORS.success,
    hover: COLORS.success,
    disabled: COLORS.disabledBackground,
  },
};

// The button's own border is unchanged on hover — the hover feedback is a
// separate white ring floating just outside the button (see HoverRing below).
export const BTN_BORDER_COLOR: Record<ButtonVariant, VariantStateColors> = {
  primary: {
    active: COLORS.transparent,
    hover: COLORS.transparent,
    disabled: COLORS.transparent,
  },
  secondary: {
    active: COLORS.border,
    hover: COLORS.border,
    disabled: COLORS.borderSubtle,
  },
  text: {
    active: COLORS.transparent,
    hover: COLORS.transparent,
    disabled: COLORS.transparent,
  },
  danger: {
    active: COLORS.transparent,
    hover: COLORS.transparent,
    disabled: COLORS.transparent,
  },
  success: {
    active: COLORS.transparent,
    hover: COLORS.transparent,
    disabled: COLORS.transparent,
  },
};

// Gap between the button edge and the hover ring.
const HOVER_RING_GAP = 3;

interface ButtonStateProps {
  getColor: (variant: ButtonVariant) => Color4;
  borderColor: (variant: ButtonVariant) => Color4;
}

// Store button states and visual properties in a Map
const buttonStates = new Map<string, ButtonStateProps>();

// Pre-compute the visual states
const ACTIVE_STATE: ButtonStateProps = {
  getColor: variant => BTN_BACKGROUND_COLOR[variant].active,
  borderColor: variant => BTN_BORDER_COLOR[variant].active,
};

const DISABLED_STATE: ButtonStateProps = {
  getColor: variant => BTN_BACKGROUND_COLOR[variant].disabled,
  borderColor: variant => BTN_BORDER_COLOR[variant].disabled,
};

const HOVER_STATE: ButtonStateProps = {
  getColor: variant => BTN_BACKGROUND_COLOR[variant].hover,
  borderColor: variant => BTN_BORDER_COLOR[variant].hover,
};

export interface CompositeButtonProps extends Omit<UiButtonProps, 'value' | 'variant'> {
  id: string;
  value?: string;
  icon?: string;
  iconRight?: string;
  iconRightTransform?: UiTransformProps;
  onlyIcon?: boolean;
  iconTransform?: UiTransformProps;
  iconBackground?: UiBackgroundProps;
  iconRightBackground?: UiBackgroundProps;
  variant?: ButtonVariant;
  labelTransform?: UiTransformProps;
}

export const Button = (props: CompositeButtonProps) => {
  const {
    id,
    value,
    onMouseDown,
    icon,
    onlyIcon,
    iconTransform,
    iconBackground,
    iconRight,
    iconRightTransform,
    fontSize = TYPE.button,
    color = COLORS.textOnPrimary,
    disabled,
    uiBackground,
    uiTransform,
    labelTransform,
    iconRightBackground,
    variant = 'primary',
  } = props;

  const buttonId = `button_${id}`;

  ReactEcs.useEffect(() => {
    buttonStates.set(buttonId, disabled ? DISABLED_STATE : ACTIVE_STATE);
  }, [disabled]);

  // Cleanup on unmount
  ReactEcs.useEffect(() => {
    return () => {
      buttonStates.delete(buttonId);
    };
  }, []);

  // Get or set initial state
  if (!buttonStates.has(buttonId)) {
    buttonStates.set(buttonId, disabled ? DISABLED_STATE : ACTIVE_STATE);
  }

  const buttonState = buttonStates.get(buttonId)!;
  const isHover = !disabled && buttonState === HOVER_STATE;
  const buttonRadius =
    typeof uiTransform?.borderRadius === 'number' ? uiTransform.borderRadius : RADIUS.sm;

  return (
    <UiEntity
      uiTransform={{
        borderColor: buttonState.borderColor(variant),
        borderWidth: 2,
        borderRadius: RADIUS.sm,
        ...uiTransform,
      }}
      uiBackground={{
        color: buttonState.getColor(variant),
        ...uiBackground,
      }}
      onMouseDown={() => {
        if (disabled) {
          return;
        }
        onMouseDown?.();
      }}
      onMouseEnter={() => {
        if (!disabled) {
          buttonStates.set(buttonId, HOVER_STATE);
        }
      }}
      onMouseLeave={() => {
        buttonStates.set(buttonId, disabled ? DISABLED_STATE : ACTIVE_STATE);
      }}
    >
      {/* TODO: Improve icon hovering state */}
      {icon && (
        <UiEntity
          uiTransform={iconTransform}
          uiBackground={{
            texture: {
              src: icon,
            },
            textureMode: 'stretch',
            ...iconBackground,
          }}
        />
      )}
      {!onlyIcon && !!value ? (
        <Label
          value={value}
          color={disabled ? COLORS.textDisabled : color}
          fontSize={fontSize}
          uiTransform={labelTransform}
        />
      ) : null}
      {iconRight && (
        <UiEntity
          uiTransform={iconRightTransform}
          uiBackground={{
            texture: {
              src: iconRight,
            },
            textureMode: 'stretch',
            ...iconRightBackground,
          }}
        />
      )}
      {/* Hover feedback: a white ring floating just outside the button, with a
          gap. Absolute + negative insets so it never shifts layout. */}
      {isHover && (
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: {
              top: -HOVER_RING_GAP,
              left: -HOVER_RING_GAP,
              right: -HOVER_RING_GAP,
              bottom: -HOVER_RING_GAP,
            },
            borderColor: COLORS.white,
            borderWidth: 2,
            borderRadius: buttonRadius + HOVER_RING_GAP,
          }}
        />
      )}
    </UiEntity>
  );
};
