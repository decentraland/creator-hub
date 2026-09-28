import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { TransformInputMode, TransformInputState } from '../../lib/logic/transform-input';
import {
  computeTransformInputEdits,
  createTransformInputState,
  formatTransformInputEntry,
  formatTransformInputHint,
  formatTransformInputResult,
  reduceTransformInputKey,
  setTransformInputArmed,
  TRANSFORM_INPUT_MODE_KEYS,
} from '../../lib/logic/transform-input';
import { GizmoType } from '../../lib/utils/gizmo';
import { useAppSelector } from '../../redux/hooks';
import { areGizmosDisabled, getHiddenPanels } from '../../redux/ui';
import { PanelName } from '../../redux/ui/types';
import type { SdkContextValue } from '../../lib/sdk/context';
import { useEntitiesWith } from '../sdk/useEntitiesWith';

const GIZMO_FOR_MODE: Record<TransformInputMode, GizmoType> = {
  position: GizmoType.POSITION,
  rotation: GizmoType.ROTATION,
  scale: GizmoType.SCALE,
};

const RESULT_TOAST_MS = 2200;

/** hotkeys-js' own filter, replicated: a shortcut must never fire while typing. */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element?.tagName) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export interface TransformInputView {
  /** The live readout while typing, or null when the modal is closed. */
  entry: string | null;
  hint: string | null;
  /** Confirmation of the last applied entry, cleared on a timer. */
  result: string | null;
}

/**
 * Numeric transform entry (#1087): `R X 15 ⏎` rotates the selection 15° about X.
 *
 * Owns the gizmo tool hotkeys (M/G, R, X) as well, because the tool key is also
 * what arms the modal — splitting the two would leave `X` ambiguous between the
 * scale tool and the X axis. The grammar itself lives in
 * `lib/logic/transform-input/grammar.ts`.
 *
 * The listener is on `document` in the CAPTURE phase so the modal can claim keys
 * the editor already binds on `document.body` (Backspace deletes entities, `-`
 * zooms out) before those handlers see them. Under Bevy the engine iframe's key
 * events arrive here re-dispatched onto `document.body` by the input-focus
 * bridge, and capture still runs first — so one listener serves both renderers.
 */
export function useTransformInput(sdk: SdkContextValue | null): TransformInputView {
  const [state, setState] = useState<TransformInputState | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isSpawnAreaSelected, setIsSpawnAreaSelected] = useState(false);

  const selectedEntities = useEntitiesWith(components => components.Selection);
  const gizmosDisabled = useAppSelector(areGizmosDisabled);
  const hiddenPanels = useAppSelector(getHiddenPanels);
  const isUIDesignerOpen = !hiddenPanels[PanelName.UI_DESIGNER];

  const spawnPointManager = sdk?.renderer.spawnPoints;
  useEffect(() => {
    if (!spawnPointManager) return;
    setIsSpawnAreaSelected(spawnPointManager.getSelectedIndex() !== null);
    return spawnPointManager.onSelectionChange(({ index }) =>
      setIsSpawnAreaSelected(index !== null),
    );
  }, [spawnPointManager]);

  // Gizmo hotkeys follow the toolbar buttons' own disabled rules: nothing
  // selected, gizmos switched off, a spawn area picked, or the 2D designer open.
  const enabled =
    !!sdk &&
    selectedEntities.length > 0 &&
    !gizmosDisabled &&
    !isUIDesignerOpen &&
    !isSpawnAreaSelected;

  // `useEntitiesWith` hands back a fresh array on ANY Selection write — including
  // the gizmo write that arms the modal — so effects key off the entity ids
  // instead, or arming would immediately disarm itself.
  const selectionKey = useMemo(() => selectedEntities.join(','), [selectedEntities]);

  const setGizmo = useCallback(
    (gizmo: GizmoType) => {
      if (!sdk || selectedEntities.length === 0) return;
      // The first selected entity carries the canonical gizmo (what the toolbar
      // writes, and what duplicate/paste read back) — the renderer's gizmo mode is
      // global, so one write switches the tool for the whole selection.
      sdk.operations.updateValue(sdk.components.Selection, selectedEntities[0], { gizmo });
      void sdk.operations.dispatch();
    },
    [sdk, selectedEntities],
  );

  const commit = useCallback(
    (committed: TransformInputState, amount: number) => {
      if (!sdk) return;
      const { Transform } = sdk.components;
      const edits = computeTransformInputEdits(
        selectedEntities,
        entity => Transform.getOrNull(entity),
        { mode: committed.mode, axis: committed.axis, amount },
      );
      if (edits.length === 0) return;
      // Snapping is deliberately NOT applied: a typed value is an exact
      // instruction and overrides the snap step. The reverse channel snaps
      // because a DRAG is approximate — this isn't.
      for (const edit of edits) {
        sdk.operations.updateValue(Transform, edit.entity, edit.transform);
      }
      // One dispatch for the whole selection keeps it a single undo step.
      void sdk.operations.dispatch();
      setResult(formatTransformInputResult(committed.mode, committed.axis, amount));
    },
    [sdk, selectedEntities],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      // Modifier combos are the editor's own shortcuts (undo, copy, duplicate…)
      // and are never part of this grammar.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (!enabled) {
        setState(null);
        return;
      }

      // The state this keystroke is judged against — `state` is stale the moment
      // the grammar releases, so the tool-key branch below reads this instead.
      const armed = state;

      if (armed) {
        const outcome = reduceTransformInputKey(armed, event.key);
        if (outcome.kind !== 'release') {
          event.preventDefault();
          event.stopPropagation();
          if (outcome.kind === 'state') setState(outcome.state);
          else if (outcome.kind === 'commit') {
            commit(armed, outcome.amount);
            setState(null);
          } else setState(null);
          return;
        }
        // Released: the key means nothing here, so close the modal and let it be
        // handled normally — including as a tool key, just below.
        setState(null);
      }

      // Auto-repeat is meaningful inside the entry (holding ⌫ erases, holding a
      // digit repeats it) but not for a tool key, where it would thrash the gizmo
      // on and off for as long as the key is held.
      if (event.repeat) return;

      const mode = TRANSFORM_INPUT_MODE_KEYS[event.key.toLowerCase()];
      if (!mode) return;
      event.preventDefault();
      const gizmo = GIZMO_FOR_MODE[mode];
      const active = sdk?.components.Selection.getOrNull(selectedEntities[0])?.gizmo;
      // Pressing the active tool's key again drops back to free movement, as the
      // toolbar buttons do. Once an axis or a value has been typed the entry is
      // worth more than the toggle, so the key restarts it instead.
      const isBlankEntry = !armed || (armed.axis === null && armed.digits === '');
      if (active === gizmo && isBlankEntry) {
        setGizmo(GizmoType.FREE);
        setState(null);
        return;
      }
      setGizmo(gizmo);
      setState(createTransformInputState(mode));
    },
    [enabled, state, commit, setGizmo, sdk, selectedEntities],
  );

  // One stable registration; the ref keeps the handler fresh without rebinding.
  const handlerRef = useRef(handleKeyDown);
  useLayoutEffect(() => {
    handlerRef.current = handleKeyDown;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handlerRef.current(event);
    // Any pointer activity (a viewport drag, a toolbar click) ends the entry — it
    // is a keyboard mode and must not linger once the mouse takes over.
    const onPointerDown = () => setState(null);
    document.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
    };
  }, []);

  // Under Bevy the viewport is an iframe, so a click in it never reaches this
  // document and the pointer listener above can't see it. The reverse channel
  // does report it, and covers Babylon identically.
  useEffect(() => {
    const events = sdk?.renderer.events;
    if (!events) return;
    const close = () => setState(null);
    events.on('pick', close);
    events.on('gizmoDrag', close);
    events.on('gizmoCommit', close);
    return () => {
      events.off('pick', close);
      events.off('gizmoDrag', close);
      events.off('gizmoCommit', close);
    };
  }, [sdk]);

  // A changed selection invalidates the centroid the entry was aimed at.
  useEffect(() => setState(null), [selectionKey]);
  useEffect(() => {
    if (!enabled) setState(null);
  }, [enabled]);

  useEffect(() => {
    setTransformInputArmed(state !== null);
    return () => setTransformInputArmed(false);
  }, [state]);

  useEffect(() => {
    if (result === null) return;
    const timeout = setTimeout(() => setResult(null), RESULT_TOAST_MS);
    return () => clearTimeout(timeout);
  }, [result]);

  return {
    entry: state ? formatTransformInputEntry(state) : null,
    hint: state ? formatTransformInputHint(state) : null,
    result,
  };
}
