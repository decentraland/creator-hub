import { useState } from 'react';
import { MenuItem, Select, Tooltip } from 'decentraland-ui2';

import type { CreatorFundPlace, PlaceReason } from '/shared/types/creator-fund';

import { misc } from '#preload';
import { getSceneJumpInDeeplink } from '/@/modules/utils';
import type { TranslationPath } from '/@/modules/store/translation/types';
import { t } from '/@/modules/store/translation/utils';

import { ModalCta, VisuallyHidden } from '../EarnModal.styled';
import {
  ArrowDownIcon,
  CheckmarkIcon,
  InProgramIcon,
  JumpInIcon,
  MetricInfoIcon,
  NotEligibleIcon,
} from '../icons';
import { StatusLine } from '../Landing.styled';
import { Spinner } from '../Spinner';
import { fontFace } from '../tokens';

import { jumpInLocation, placeTitle } from './format';
import {
  Chip,
  CycleSelectBox,
  ErrorLine,
  FilterGroup,
  FilterLabel,
  JumpIn,
  Metric,
  MetricInfoButton,
  MetricLabel,
  MetricLabelText,
  MetricSkeleton,
  MetricValue,
  StateBox,
  TooltipLine,
} from './parts.styled';

const REASONS: Record<PlaceReason, TranslationPath> = {
  content_policy: 'earn.joined.my_places.reasons.content_policy',
  excluded: 'earn.joined.my_places.reasons.excluded',
  not_owner: 'earn.joined.my_places.reasons.not_owner',
  creator_not_eligible: 'earn.joined.my_places.reasons.creator_not_eligible',
  terms_outdated: 'earn.joined.my_places.reasons.terms_outdated',
};

const reasonLines = (reasons: string[]) => [
  ...new Set(
    (reasons.length ? reasons : ['unknown']).map(
      reason => REASONS[reason as PlaceReason] ?? 'earn.joined.my_places.reasons.unknown',
    ),
  ),
];

/** The design-system Tooltip's look for EARN tooltips. */
export const TOOLTIP_SLOTS = {
  tooltip: {
    sx: {
      ...fontFace,
      backgroundColor: 'var(--onyx)',
      borderRadius: 'var(--shape-borderRadiusLarge)',
      padding: '16px 20px',
      maxWidth: 340,
      fontSize: 'var(--type-h7-regular-size)',
      fontWeight: 'var(--type-h7-regular-weight)',
      lineHeight: 'normal',
      color: 'var(--gray)',
      boxShadow: 'var(--shadow-tooltip)',
    },
  },
  arrow: { sx: { color: 'var(--onyx)' } },
};

export type ChipProps =
  | { status: 'in_program' }
  | { status: 'not_eligible'; reasons: string[] }
  | { status: 'replaced' };

function ExplainedChip({
  status,
  icon,
  title,
}: {
  status: 'not_eligible' | 'replaced';
  icon?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <Tooltip
      title={title}
      placement="top"
      arrow
      describeChild
      slotProps={TOOLTIP_SLOTS}
    >
      <Chip
        data-status={status}
        tabIndex={0}
      >
        {icon}
        {t(`earn.joined.my_places.status.${status}`)}
      </Chip>
    </Tooltip>
  );
}

/** The program status of one of the user's places; the other statuses explain themselves in a tooltip. */
export function StatusChip(props: ChipProps) {
  if (props.status === 'in_program') {
    return (
      <Chip data-status="in_program">
        <InProgramIcon />
        {t('earn.joined.my_places.status.in_program')}
      </Chip>
    );
  }
  if (props.status === 'replaced') {
    return (
      <ExplainedChip
        status="replaced"
        title={t('earn.joined.my_places.replaced_tooltip')}
      />
    );
  }
  return (
    <ExplainedChip
      status="not_eligible"
      icon={<NotEligibleIcon />}
      title={reasonLines(props.reasons).map(reason => (
        <TooltipLine key={reason}>{t(reason)}</TooltipLine>
      ))}
    />
  );
}

export type MetricReading = { status: 'loading' } | { status: 'ready'; value: string | null };

function MetricReadingValue({ reading }: { reading: MetricReading }) {
  if (reading.status === 'loading') {
    return (
      <MetricValue aria-busy="true">
        <MetricSkeleton aria-hidden />
        <VisuallyHidden>{t('earn.loading')}</VisuallyHidden>
      </MetricValue>
    );
  }
  return (
    <MetricValue>
      {reading.value ?? (
        <>
          <span aria-hidden>-</span>
          <VisuallyHidden>{t('earn.joined.my_places.metrics.no_data')}</VisuallyHidden>
        </>
      )}
    </MetricValue>
  );
}

export type MetricExplanation = { name: string; tooltip: string };

function MetricInfo({ name, tooltip }: MetricExplanation) {
  return (
    <Tooltip
      title={tooltip}
      placement="top"
      arrow
      describeChild
      slotProps={TOOLTIP_SLOTS}
    >
      <MetricInfoButton
        type="button"
        aria-label={name}
      >
        <MetricInfoIcon />
      </MetricInfoButton>
    </Tooltip>
  );
}

/**
 * One metric of a place: a skeleton named "Loading" while it loads, "-" named "No data" when absent.
 * @param props.info - an ⓘ button after the label: its accessible name and its tooltip.
 */
export function MetricStat({
  icon,
  label,
  info,
  reading,
}: {
  icon: React.ReactNode;
  label: string;
  info?: MetricExplanation;
  reading: MetricReading;
}) {
  return (
    <Metric>
      <MetricLabel>
        {icon}
        <MetricLabelText title={label}>{label}</MetricLabelText>
        {info && <MetricInfo {...info} />}
      </MetricLabel>
      <MetricReadingValue reading={reading} />
    </Metric>
  );
}

/**
 * Opens a place in the explorer: a scene in a World of several scenes at its own position.
 * @param props.scenesInWorld - the place's World scene count, when known.
 * @param props.onJumpIn - called before the explorer opens.
 */
export function JumpInButton({
  place,
  scenesInWorld = 0,
  onJumpIn,
}: {
  place: CreatorFundPlace;
  scenesInWorld?: number;
  onJumpIn?: () => void;
}) {
  return (
    <JumpIn
      variant="contained"
      disableRipple
      aria-label={t('earn.joined.leaderboard.jump_in_label', { place: placeTitle(place) })}
      onClick={() => {
        onJumpIn?.();
        void misc.openExternal(
          getSceneJumpInDeeplink(jumpInLocation(place), { position: scenesInWorld > 1 }),
        );
      }}
    >
      {t('earn.joined.leaderboard.jump_in')}
      <JumpInIcon />
    </JumpIn>
  );
}

export type ListStateProps =
  | { kind: 'loading' }
  | { kind: 'empty'; message: string }
  | { kind: 'error'; message: string; onRetry: () => void };

/** A list's loading, empty or error state, centred where the rows would be. */
export function ListState(props: ListStateProps) {
  return (
    <StateBox data-kind={props.kind}>
      {props.kind === 'loading' && (
        <Spinner
          label={t('earn.loading')}
          size={48}
        />
      )}
      {props.kind === 'empty' && <StatusLine role="status">{props.message}</StatusLine>}
      {props.kind === 'error' && (
        <>
          <ErrorLine role="alert">{props.message}</ErrorLine>
          <ModalCta
            variant="contained"
            color="secondary"
            size="large"
            onClick={props.onRetry}
          >
            {t('earn.errors.retry')}
          </ModalCta>
        </>
      )}
    </StateBox>
  );
}

const cycleMenuProps = (keyboard: boolean) =>
  ({
    disableScrollLock: true,
    anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
    transformOrigin: { vertical: 'top', horizontal: 'right' },
    slotProps: {
      paper: {
        'data-keyboard': keyboard ? 'true' : undefined,
        sx: {
          minWidth: 200,
          marginTop: '10px',
          padding: '10px 0',
          backgroundColor: 'var(--menu-bg)',
          backgroundImage: 'none',
          border: '1px solid var(--palette-whiteTransparent-subtle)',
          borderRadius: 'var(--shape-borderRadiusLarge)',
          boxShadow: 'var(--menu-shadow)',
          '& .MuiList-root': { padding: '0 10px' },
          '& .MuiMenuItem-root': {
            ...fontFace,
            display: 'flex',
            alignItems: 'center',
            minHeight: 38,
            padding: '0 10px',
            gap: '10px',
            borderRadius: 'var(--shape-borderRadiusMedium)',
            fontSize: 'var(--type-h6-regular-size)',
            fontWeight: 'var(--type-h6-regular-weight)',
            lineHeight: 1.5,
            letterSpacing: '0.15px',
            color: 'var(--palette-neutral-softWhite)',
          },
          '& .MuiMenuItem-root svg': { flexShrink: 0, color: 'var(--palette-neutral-softWhite)' },
          '&& .MuiMenuItem-root.Mui-focusVisible': { backgroundColor: 'transparent' },
          '&& .MuiMenuItem-root:hover, && .MuiMenuItem-root.Mui-selected, && .MuiMenuItem-root.Mui-selected:hover, &&[data-keyboard="true"] .MuiMenuItem-root.Mui-focusVisible':
            { backgroundColor: 'var(--dark-gray)' },
          '&&[data-keyboard="true"] .MuiMenuItem-root.Mui-focusVisible': {
            outline: '2px solid var(--palette-info-light)',
            outlineOffset: -2,
          },
        },
      },
    },
  }) as const;

export type CycleOption = { value: string; label: string };

/** The filter bar's "Cycle" select. */
export function CycleSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: CycleOption[];
  onChange: (value: string) => void;
}) {
  const [keyboard, setKeyboard] = useState(false);
  return (
    <FilterGroup>
      <FilterLabel aria-hidden>{t('earn.joined.filter.cycle')}</FilterLabel>
      <CycleSelectBox
        onKeyDownCapture={() => setKeyboard(true)}
        onPointerDownCapture={() => setKeyboard(false)}
      >
        <Select
          variant="standard"
          value={value}
          onChange={event => onChange(event.target.value as string)}
          renderValue={selected => options.find(option => option.value === selected)?.label}
          IconComponent={ArrowDownIcon}
          autoWidth
          MenuProps={cycleMenuProps(keyboard)}
          inputProps={{ 'aria-label': t('earn.joined.filter.cycle') }}
        >
          {options.map(option => (
            <MenuItem
              key={option.value}
              value={option.value}
            >
              {option.value === value && <CheckmarkIcon />}
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </CycleSelectBox>
    </FilterGroup>
  );
}
