import type { Emitter } from 'mitt';
import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import {
  CrdtMessageType,
  EntityState,
  Name as NameEngine,
  Transform as TransformEngine,
} from '@dcl/ecs';

import { EditorComponentNames } from '../sdk/components';
import type { SdkContextEvents } from '../sdk/context';
import { GizmoType } from '../utils/gizmo';
import { describeEntity, entityRef } from './entity-names';
import { listWithMore, shortJson, summariseTransform, truncate } from './text';
import type { Emit, StopTracker } from './types';

export type EcsTrackerOptions = {
  engine: IEngine;
  events: Pick<Emitter<SdkContextEvents>, 'on' | 'off'>;
  emit: Emit;
  now?: () => number;
  /** Structural changes (create/delete/add/remove) and selection settle over this window. */
  settleMs?: number;
  /** Value changes to one component of one entity are merged over this quiet window… */
  coalesceMs?: number;
  /** …but a continuous change (a long drag) still reports at least this often. */
  maxCoalesceMs?: number;
};

const SELECTION = 'inspector::Selection';
const NAME = NameEngine.componentName;
const TRANSFORM = TransformEngine.componentName;
const SCENE_METADATA = 'inspector::SceneMetadata';
const TOGGLES: Record<string, { on: string; off: string }> = {
  'inspector::Hide': { on: 'Hid', off: 'Showed' },
  'inspector::Lock': { on: 'Locked', off: 'Unlocked' },
};
// Editor bookkeeping the user never touches directly: the tree structure (reparenting
// already shows as a Transform parent change), per-entity editor config and UI state.
const NOISE = new Set([
  'inspector::Nodes',
  'inspector::TransformConfig',
  'inspector::Config',
  'inspector::Ground',
  'inspector::Tile',
  'inspector::UIState',
  'inspector::CustomAsset',
]);
const MAX_LISTED_ENTITIES = 3;

const GIZMO_NAMES: Record<number, string> = {
  [GizmoType.FREE]: 'Free movement',
  [GizmoType.POSITION]: 'Translation',
  [GizmoType.ROTATION]: 'Rotation',
  [GizmoType.SCALE]: 'Scaling',
};

/** Versioned editor components register as `inspector::Hide-v1`; compare by the base name. */
export function baseComponentName(componentName: string): string {
  return componentName.replace(/-v\d+$/, '');
}

export function shortComponentName(componentName: string): string {
  const base = baseComponentName(componentName);
  if (base === SCENE_METADATA) return 'Scene settings';
  return base.split('::').pop() ?? base;
}

type StructuralChange = {
  t: number;
  created: boolean;
  deleted: boolean;
  added: Set<string>;
  removed: Set<string>;
  toggles: Map<string, boolean>;
};

type ValueChange = {
  entity: Entity;
  base: string;
  value: unknown;
  t: number;
  timer: ReturnType<typeof setTimeout>;
  oldName?: string;
};

function topLevelDiff(prevJson: string | undefined, value: unknown): string | undefined {
  if (!prevJson || !value || typeof value !== 'object') return undefined;
  let prev: Record<string, unknown>;
  try {
    prev = JSON.parse(prevJson);
  } catch {
    return undefined;
  }
  const next = value as Record<string, unknown>;
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changed = Array.from(keys).filter(
    key => shortJson(prev[key], 10_000) !== shortJson(next[key], 10_000),
  );
  if (changed.length === 0) return undefined;
  return changed.map(key => `${key} ${shortJson(next[key], 60)}`).join(', ');
}

/** Turns inspector-engine changes into selection, entity and component events. */
export function trackEcs({
  engine,
  events,
  emit,
  now = Date.now,
  settleMs = 100,
  coalesceMs = 500,
  maxCoalesceMs = 2000,
}: EcsTrackerOptions): StopTracker {
  const names = new Map<Entity, string>();
  const presence = new Map<Entity, Set<string>>();
  const lastJson = new Map<string, string>();
  const structural = new Map<Entity, StructuralChange>();
  const values = new Map<string, ValueChange>();
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let selectionDirty = false;

  const selectionComponent = engine.getComponentOrNull(
    EditorComponentNames.Selection,
  ) as LastWriteWinElementSetComponentDefinition<{
    gizmo?: number;
  }> | null;

  function currentSelection(): Entity[] {
    if (!selectionComponent) return [];
    return Array.from(engine.getEntitiesWith(selectionComponent), ([entity]) => entity).sort(
      (a, b) => a - b,
    );
  }

  function currentGizmo(selection: Entity[]): number | undefined {
    if (!selectionComponent || selection.length === 0) return undefined;
    return selectionComponent.getOrNull(selection[0])?.gizmo;
  }

  for (const component of engine.componentsIter()) {
    const base = baseComponentName(component.componentName);
    for (const [entity, value] of engine.getEntitiesWith(component)) {
      if (!presence.has(entity)) presence.set(entity, new Set());
      presence.get(entity)!.add(base);
      if (base === NAME) names.set(entity, (value as { value: string }).value);
      if (base === SCENE_METADATA) lastJson.set(`${entity}:${base}`, shortJson(value, 1_000_000));
    }
  }
  let lastSelection = currentSelection();
  let lastGizmo = currentGizmo(lastSelection);

  const label = (entity: Entity) => describeEntity(engine, entity, names.get(entity));
  const ref = (entity: Entity) => entityRef(engine, entity, names.get(entity));

  function scheduleSettle() {
    if (!settleTimer) settleTimer = setTimeout(settle, settleMs);
  }

  function structuralFor(entity: Entity): StructuralChange {
    let change = structural.get(entity);
    if (!change) {
      change = {
        t: now(),
        created: false,
        deleted: false,
        added: new Set(),
        removed: new Set(),
        toggles: new Map(),
      };
      structural.set(entity, change);
    }
    scheduleSettle();
    return change;
  }

  // ---- selection ----------------------------------------------------------------------

  function emitSelection() {
    selectionDirty = false;
    const selection = currentSelection();
    const gizmo = currentGizmo(selection);
    const changed =
      selection.length !== lastSelection.length || selection.some((e, i) => e !== lastSelection[i]);
    if (changed) {
      lastSelection = selection;
      if (selection.length === 0) {
        emit({ kind: 'select', text: 'Cleared the selection' });
      } else if (selection.length === 1 && selection[0] === engine.RootEntity) {
        emit({ kind: 'select', text: 'Selected the scene root (Scene settings)' });
      } else if (selection.length === 1) {
        emit({
          kind: 'select',
          text: `Selected ${label(selection[0])}`,
          entity: ref(selection[0]),
        });
      } else {
        emit({
          kind: 'select',
          text: `Selected ${selection.length} entities: ${listWithMore(selection.map(label), 5)}`,
        });
      }
    }
    if (gizmo !== undefined && lastGizmo !== undefined && gizmo !== lastGizmo) {
      emit({ kind: 'mode', text: `Switched the gizmo to ${GIZMO_NAMES[gizmo] ?? gizmo}` });
    }
    if (gizmo !== undefined) lastGizmo = gizmo;
  }

  // ---- value changes ------------------------------------------------------------------

  function emitValue(key: string) {
    const change = values.get(key);
    if (!change) return;
    values.delete(key);
    clearTimeout(change.timer);
    const { entity, base, value, t } = change;
    if (base === NAME) {
      const next = (value as { value?: string } | undefined)?.value ?? '';
      if (next === change.oldName) return;
      emit({
        t,
        kind: 'entity',
        text: `Renamed "${change.oldName ?? 'Unnamed entity'}" to "${next}" (#${entity})`,
        entity: ref(entity),
      });
      return;
    }
    let summary: string;
    if (base === TRANSFORM) {
      const transform = value as Parameters<typeof summariseTransform>[0] & { parent?: Entity };
      summary = summariseTransform(transform);
      if (transform.parent !== undefined && transform.parent !== engine.RootEntity) {
        summary += `, parent ${label(transform.parent)}`;
      }
    } else {
      summary = topLevelDiff(lastJson.get(key), value) ?? shortJson(value);
    }
    lastJson.set(key, shortJson(value, 1_000_000));
    const subject =
      base === SCENE_METADATA
        ? 'the scene settings'
        : `${shortComponentName(base)} of ${label(entity)}`;
    emit({
      t,
      kind: 'component',
      text: `Changed ${subject}: ${truncate(summary, 150)}`,
      ...(base !== SCENE_METADATA && { entity: ref(entity) }),
    });
  }

  function recordValue(entity: Entity, base: string, value: unknown, oldName?: string) {
    const key = `${entity}:${base}`;
    const existing = values.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      existing.value = value;
      if (now() - existing.t >= maxCoalesceMs) {
        emitValue(key);
        return;
      }
      existing.timer = setTimeout(() => emitValue(key), coalesceMs);
      return;
    }
    values.set(key, {
      entity,
      base,
      value,
      t: now(),
      oldName,
      timer: setTimeout(() => emitValue(key), coalesceMs),
    });
  }

  function dropValues(entity: Entity, base?: string) {
    for (const [key, change] of Array.from(values)) {
      if (change.entity !== entity || (base && change.base !== base)) continue;
      clearTimeout(change.timer);
      values.delete(key);
    }
  }

  // ---- structural changes -------------------------------------------------------------

  function emitEntities(verb: string, entities: Entity[], t: number, details?: string[]) {
    if (entities.length === 0) return;
    if (entities.length > MAX_LISTED_ENTITIES) {
      emit({
        t,
        kind: 'entity',
        text: `${verb} ${entities.length} entities: ${listWithMore(entities.map(label), 5)}`,
      });
      return;
    }
    entities.forEach((entity, i) => {
      const extra = details?.[i] ? ` with ${details[i]}` : '';
      emit({ t, kind: 'entity', text: `${verb} ${label(entity)}${extra}`, entity: ref(entity) });
    });
  }

  function settle() {
    settleTimer = null;
    const created: Entity[] = [];
    const createdDetails: string[] = [];
    const deleted: Entity[] = [];
    let createdAt = Infinity;
    let deletedAt = Infinity;

    for (const [entity, change] of Array.from(structural)) {
      const remaining = presence.get(entity)?.size ?? 0;
      // The inspector removes an entity by deleting each of its components, so "no
      // components left" is what a deletion looks like here, not DELETE_ENTITY.
      const gone =
        change.deleted || remaining === 0 || engine.getEntityState(entity) === EntityState.Removed;
      if (gone) {
        if (!change.created) {
          deleted.push(entity);
          deletedAt = Math.min(deletedAt, change.t);
        }
        continue;
      }
      if (change.created) {
        created.push(entity);
        createdAt = Math.min(createdAt, change.t);
        createdDetails.push(listWithMore(Array.from(change.added), 4));
        continue;
      }
      const target = { entity: ref(entity) };
      for (const component of change.added) {
        emit({
          t: change.t,
          kind: 'component',
          text: `Added ${component} to ${label(entity)}`,
          ...target,
        });
      }
      for (const component of change.removed) {
        emit({
          t: change.t,
          kind: 'component',
          text: `Removed ${component} from ${label(entity)}`,
          ...target,
        });
      }
      for (const [base, on] of change.toggles) {
        const verbs = TOGGLES[base];
        emit({
          t: change.t,
          kind: 'component',
          text: `${on ? verbs.on : verbs.off} ${label(entity)}`,
          ...target,
        });
      }
    }
    structural.clear();
    emitEntities('Created', created, createdAt, createdDetails);
    emitEntities('Deleted', deleted, deletedAt);
    for (const entity of deleted) {
      names.delete(entity);
      presence.delete(entity);
    }
    if (selectionDirty) emitSelection();
  }

  // ---- the change stream --------------------------------------------------------------

  function onChange({ entity, operation, component, value }: SdkContextEvents['change']) {
    if (operation === CrdtMessageType.DELETE_ENTITY) {
      dropValues(entity);
      structuralFor(entity).deleted = true;
      presence.set(entity, new Set());
      selectionDirty = true;
      return;
    }
    if (!component) return;
    const base = baseComponentName(component.componentName);
    const reserved =
      entity === engine.RootEntity ||
      entity === engine.PlayerEntity ||
      entity === engine.CameraEntity;
    const isNew = !reserved && !presence.has(entity) && !names.has(entity);
    if (!presence.has(entity)) presence.set(entity, new Set());
    const present = presence.get(entity)!;
    const had = present.has(base);
    const isPut =
      operation === CrdtMessageType.PUT_COMPONENT || operation === CrdtMessageType.APPEND_VALUE;

    if (isPut) present.add(base);
    else present.delete(base);
    if (isNew) structuralFor(entity).created = true;

    if (base === SELECTION) {
      selectionDirty = true;
      scheduleSettle();
      return;
    }

    const pending = structural.get(entity);
    if (base === NAME && isPut) {
      const oldName = names.get(entity);
      names.set(entity, (value as { value: string } | undefined)?.value ?? '');
      if (pending?.created || !had) return;
      recordValue(entity, base, value, oldName);
      return;
    }
    if (NOISE.has(base)) return;

    const short = shortComponentName(base);
    if (pending?.created) {
      if (isPut) pending.added.add(short);
      return;
    }
    if (TOGGLES[base]) {
      const on = isPut && !!(value as { value?: boolean } | undefined)?.value;
      structuralFor(entity).toggles.set(base, on);
      return;
    }
    if (!isPut) {
      dropValues(entity, base);
      const change = structuralFor(entity);
      if (!change.added.delete(short)) change.removed.add(short);
      return;
    }
    if (!had) {
      structuralFor(entity).added.add(short);
      return;
    }
    recordValue(entity, base, value);
  }

  events.on('change', onChange);

  return () => {
    events.off('change', onChange);
    if (settleTimer) clearTimeout(settleTimer);
    settle();
    for (const key of Array.from(values.keys())) emitValue(key);
  };
}
