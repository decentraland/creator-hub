// eslint-disable-next-line @typescript-eslint/no-unused-vars -- ReactEcs is the JSX factory
import ReactEcs, { Label, UiEntity, type UiTransformProps } from '@dcl/react-ecs';
import { type Color4 } from '@dcl/sdk/math';
import { COLORS, RADIUS, SPACING, TYPE } from './theme';
import { icon, type IconName } from './icons';
import { Icon, IconBadge } from './Primitives';
import { Button } from './Button';
import { FeedbackButton } from './FeedbackButton';

// Filled (magenta) or outlined pill button with an optional leading icon.
export function PillButton({
  id,
  label,
  iconName,
  variant,
  onClick,
  disabled,
  uiTransform,
}: {
  id: string;
  label: string;
  iconName?: IconName;
  variant: 'filled' | 'outlined';
  onClick: () => void;
  disabled?: boolean;
  uiTransform?: UiTransformProps;
}) {
  const filled = variant === 'filled';
  const fg = filled ? COLORS.white : COLORS.textTertiary;
  return (
    <Button
      id={id}
      value={`<b>${label}</b>`}
      variant={filled ? 'primary' : 'secondary'}
      fontSize={TYPE.body}
      color={fg}
      disabled={disabled}
      icon={iconName ? icon(iconName) : undefined}
      iconTransform={
        iconName ? { width: 15, height: 15, margin: { right: SPACING.sm } } : undefined
      }
      iconBackground={iconName ? { color: fg } : undefined}
      uiTransform={{
        height: 40,
        borderRadius: RADIUS.md,
        alignItems: 'center',
        justifyContent: 'center',
        padding: { left: 16, right: 16 },
        ...uiTransform,
      }}
      onMouseDown={onClick}
    />
  );
}

// A link row inside a card: tinted icon badge + title/description + Copy pill.
export function CopyRow({
  badge,
  badgeVariant,
  id,
  title,
  description,
  onCopy,
}: {
  id: string;
  badge: IconName;
  badgeVariant: 'magenta' | 'blue';
  title: string;
  description: string;
  onCopy: () => void;
}) {
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: { left: SPACING.xl, right: SPACING.xl, top: SPACING.lg, bottom: SPACING.lg },
      }}
    >
      <IconBadge
        name={badge}
        variant={badgeVariant}
      />
      <UiEntity
        uiTransform={{
          flexGrow: 1,
          flexBasis: 0,
          flexDirection: 'column',
          margin: { left: SPACING.lg },
        }}
      >
        <Label
          value={`<b>${title}</b>`}
          fontSize={TYPE.body}
          color={COLORS.textPrimary}
        />
        <Label
          value={description}
          fontSize={TYPE.small}
          color={COLORS.textSecondary}
        />
      </UiEntity>
      <CopyButton
        id={id}
        onCopy={onCopy}
      />
    </UiEntity>
  );
}

// Segmented control (e.g. media source URL / DCL Cast / Stream).
export function Segmented<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: { key: T; label: string; icon: IconName }[];
  selected: T | undefined;
  onSelect: (key: T) => void;
}) {
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        flexDirection: 'row',
        padding: SPACING.xxs,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
      uiBackground={{ color: COLORS.surface }}
    >
      {options.map(option => {
        const active = option.key === selected;
        return (
          <UiEntity
            key={option.key}
            uiTransform={{
              flexGrow: 1,
              flexBasis: 0,
              height: 32,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: RADIUS.sm,
              margin: { left: SPACING.xxs, right: SPACING.xxs },
            }}
            uiBackground={{ color: active ? COLORS.primary : COLORS.transparent }}
            onMouseDown={() => onSelect(option.key)}
          >
            <Icon
              name={option.icon}
              size={15}
              color={active ? COLORS.white : COLORS.textSecondary}
              uiTransform={{ margin: { right: SPACING.sm } }}
            />
            <Label
              value={active ? `<b>${option.label}</b>` : option.label}
              fontSize={TYPE.body}
              color={active ? COLORS.white : COLORS.textSecondary}
            />
          </UiEntity>
        );
      })}
    </UiEntity>
  );
}

// Outlined "Copy" pill.
export function CopyButton({ id, onCopy }: { id: string; onCopy: () => void }) {
  return (
    <FeedbackButton
      id={id}
      value="Copy"
      feedbackLabel="<b>Copied</b>"
      variant="secondary"
      fontSize={TYPE.label}
      color={COLORS.textTertiary}
      icon={icon('copy')}
      iconTransform={{ width: 14, height: 14, margin: { right: 5 } }}
      iconBackground={{ color: COLORS.textTertiary }}
      uiTransform={{
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RADIUS.sm,
        flexShrink: 0,
        padding: { left: SPACING.lg, right: SPACING.lg, top: SPACING.sm, bottom: SPACING.sm },
      }}
      onMouseDown={onCopy}
    />
  );
}

// Text + icon action link (bottom row: Deactivate / Reset).
export function ActionLink({
  label,
  iconName,
  color = COLORS.textSecondary,
  onClick,
}: {
  label: string;
  iconName: IconName;
  color?: Color4;
  onClick: () => void;
}) {
  return (
    <UiEntity
      uiTransform={{ flexDirection: 'row', alignItems: 'center' }}
      // A background (even transparent) is required for the element to be
      // hit-tested; without it the onMouseDown never fires.
      uiBackground={{ color: COLORS.transparent }}
      onMouseDown={onClick}
    >
      <Icon
        name={iconName}
        size={14}
        color={color}
        uiTransform={{ margin: { right: 5 } }}
      />
      <Label
        value={label}
        fontSize={TYPE.caption}
        color={color}
      />
    </UiEntity>
  );
}

// Volume-style slider. react-ecs has no drag, so the track is split into
// `steps` clickable cells spanning the full 0..1 range (leftmost cell mutes).
export function Slider({
  value,
  onSet,
  steps = 11,
}: {
  value: number;
  onSet: (value: number) => void;
  steps?: number;
}) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <UiEntity
      uiTransform={{
        flexGrow: 1,
        flexBasis: 0,
        height: 18,
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <UiEntity
        uiTransform={{ width: '100%', height: 4, borderRadius: 2 }}
        uiBackground={{ color: COLORS.surfaceHover }}
      >
        <UiEntity
          uiTransform={{
            positionType: 'absolute',
            position: { left: 0, top: 0, bottom: 0 },
            width: `${pct * 100}%`,
            borderRadius: 2,
          }}
          uiBackground={{ color: COLORS.primary }}
        >
          <UiEntity
            uiTransform={{
              positionType: 'absolute',
              position: { right: -6, top: -6 },
              width: 16,
              height: 16,
              borderRadius: 8,
            }}
            uiBackground={{ color: COLORS.white }}
          />
        </UiEntity>
      </UiEntity>
      <UiEntity
        uiTransform={{
          positionType: 'absolute',
          position: { left: 0, top: 0 },
          width: '100%',
          height: 18,
          flexDirection: 'row',
        }}
      >
        {Array.from({ length: steps }).map((_, i) => (
          <UiEntity
            key={`cell-${i}`}
            uiTransform={{ flexGrow: 1, flexBasis: 0, height: 18 }}
            // A background (even transparent) is required for the element to be
            // hit-tested; without it the onMouseDown never fires.
            uiBackground={{ color: COLORS.transparent }}
            onMouseDown={() => onSet(i / (steps - 1))}
          />
        ))}
      </UiEntity>
    </UiEntity>
  );
}
