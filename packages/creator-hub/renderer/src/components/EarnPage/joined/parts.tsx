import { useState } from 'react';
import { MenuItem, Select } from 'decentraland-ui2';

import type { CreatorFundPlace } from '/shared/types/creator-fund';

import { misc } from '#preload';
import { getSceneJumpInDeeplink } from '/@/modules/utils';
import { t } from '/@/modules/store/translation/utils';

import { ModalCta } from '../EarnModal.styled';
import { ArrowDownIcon, CheckmarkIcon, JumpInIcon } from '../icons';
import { StatusLine } from '../Landing.styled';
import { Spinner } from '../Spinner';
import { fontFace } from '../tokens';

import { jumpInLocation, placeTitle } from './format';
import {
  CycleSelectBox,
  ErrorLine,
  FilterGroup,
  FilterLabel,
  JumpIn,
  StateBox,
} from './parts.styled';

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
