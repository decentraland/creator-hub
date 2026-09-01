// eslint-disable-next-line @typescript-eslint/consistent-type-imports, @typescript-eslint/no-unused-vars -- ReactEcs is the JSX factory
import ReactEcs, { Label, UiEntity, type UiTransformProps } from '@dcl/react-ecs';
import { type Color4 } from '@dcl/sdk/math';
import { COLORS, RADIUS, SPACING, TYPE } from './theme';
import { icon, type IconName } from './icons';

// A white glyph tinted to any color.
export function Icon({
  name,
  size = 16,
  color = COLORS.textPrimary,
  uiTransform,
}: {
  name: IconName;
  size?: number;
  color?: Color4;
  uiTransform?: UiTransformProps;
}) {
  return (
    <UiEntity
      uiTransform={{ width: size, height: size, ...uiTransform }}
      uiBackground={{ textureMode: 'stretch', color, texture: { src: icon(name) } }}
    />
  );
}

// Header tab: 32x32 rounded square, magenta fill when active, muted icon when idle.
export function IconTab({
  name,
  active,
  enabled = true,
  onClick,
}: {
  name: IconName;
  active: boolean;
  enabled?: boolean;
  onClick: () => void;
}) {
  return (
    <UiEntity
      uiTransform={{
        display: enabled ? 'flex' : 'none',
        width: 32,
        height: 32,
        borderRadius: RADIUS.sm,
        alignItems: 'center',
        justifyContent: 'center',
        margin: { left: SPACING.xs },
      }}
      uiBackground={{ color: active ? COLORS.primary : COLORS.transparent }}
      onMouseDown={onClick}
    >
      <Icon
        name={name}
        size={17}
        color={active ? COLORS.white : COLORS.textSecondary}
      />
    </UiEntity>
  );
}

// Green "Active" status pill.
export function ActivePill() {
  // react-ecs doesn't clamp border-radius to half the box (CSS does), so a huge
  // radius turns a short box into an ellipse. Use radius = height/2 for a clean
  // stadium, and keep the pill hugging its content (alignSelf flex-start).
  return (
    <UiEntity
      uiTransform={{
        height: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        borderRadius: 11,
        padding: { left: 10, right: 10 },
      }}
      uiBackground={{ color: COLORS.successBg }}
    >
      <UiEntity
        uiTransform={{ width: 6, height: 6, borderRadius: 3, margin: { right: 5 } }}
        uiBackground={{ color: COLORS.success }}
      />
      <Label
        value="Active"
        fontSize={TYPE.label}
        color={COLORS.success}
      />
    </UiEntity>
  );
}

// Section title (15px medium) with an optional right-aligned accessory.
export function SectionHeader({
  title,
  right,
}: {
  title: string;
  right?: ReactEcs.JSX.Element | false;
}) {
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Label
        value={`<b>${title}</b>`}
        fontSize={TYPE.title}
        color={COLORS.textPrimary}
      />
      {right}
    </UiEntity>
  );
}

// A field/label caption (12px muted).
export function FieldLabel({ text }: { text: string }) {
  return (
    <Label
      value={text}
      fontSize={TYPE.label}
      color={COLORS.textSecondary}
      uiTransform={{ margin: { bottom: SPACING.sm } }}
    />
  );
}

// Elevated surface / card.
export function Surface({
  children,
  uiTransform,
}: {
  children?: ReactEcs.JSX.Element | (ReactEcs.JSX.Element | false)[];
  uiTransform?: UiTransformProps;
}) {
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        flexDirection: 'column',
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...uiTransform,
      }}
      uiBackground={{ color: COLORS.surface }}
    >
      {children}
    </UiEntity>
  );
}

// Circular tinted icon badge (magenta / blue).
export function IconBadge({ name, variant }: { name: IconName; variant: 'magenta' | 'blue' }) {
  return (
    <UiEntity
      uiTransform={{
        width: 34,
        height: 34,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      uiBackground={{ color: variant === 'magenta' ? COLORS.badgeMagenta : COLORS.badgeBlue }}
    >
      <Icon
        name={name}
        size={17}
        color={variant === 'magenta' ? COLORS.primary : COLORS.info}
      />
    </UiEntity>
  );
}

export function Divider({ uiTransform }: { uiTransform?: UiTransformProps }) {
  return (
    <UiEntity
      uiTransform={{ width: '100%', height: 1, ...uiTransform }}
      uiBackground={{ color: COLORS.divider }}
    />
  );
}
