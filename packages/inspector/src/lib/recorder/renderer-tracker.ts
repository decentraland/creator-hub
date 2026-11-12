import type { Entity, IEngine } from '@dcl/ecs';
import { EntityState } from '@dcl/ecs';

import type {
  IRenderer,
  RendererActivity,
  SceneEntityChange,
  Unsubscribe,
} from '../renderer/types';
import { entityRef, nameOf } from './entity-names';
import { entityLabel, formatVector } from './text';
import type { Emit, EntityRef, StopTracker } from './types';

export type RendererTrackerOptions = {
  engine: IEngine;
  renderer: Pick<
    IRenderer,
    'activity' | 'sceneRun' | 'interaction' | 'editorCamera' | 'audio' | 'gizmos'
  >;
  emit: Emit;
  now?: () => number;
  /** A pointer target must stay this long to count: sweeping across the scene isn't intent. */
  pointerDwellMs?: number;
  /** Player positions closer together than this (time or metres) are not reported again. */
  playerMinIntervalMs?: number;
  playerMinDistance?: number;
  /** How long to wait for the running scene to say what a code-created entity looks like. */
  describeTimeoutMs?: number;
};

type Vec3 = { x: number; y: number; z: number };

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function isCodeCreated(engine: IEngine, entity: Entity): boolean {
  const reserved =
    entity === engine.RootEntity ||
    entity === engine.PlayerEntity ||
    entity === engine.CameraEntity;
  return !reserved && engine.getEntityState(entity) !== EntityState.UsedEntity;
}

// "a red box (clickable: "Grab")" → "red box": the short name used in pointing notes.
function shortName(description: string): string {
  return description
    .replace(/^(an?|the)\s+/i, '')
    .replace(/\s+with \d+ attached parts?$/, '')
    .replace(/\s*\(clickable: .*\)$/, '');
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What to call an entity the renderer reported, including ones only the scene's code knows. */
export function describeRendererEntity(
  engine: IEngine,
  entity: Entity,
  meshName?: string,
): { text: string; ref: EntityRef } {
  if (!isCodeCreated(engine, entity)) {
    const name = nameOf(engine, entity);
    return {
      text: entityLabel(name ?? 'Unnamed entity', entity),
      ref: entityRef(engine, entity, name),
    };
  }
  const mesh = meshName ? `, mesh "${meshName}"` : '';
  return {
    text: `an entity created by the scene's code (#${entity}${mesh})`,
    ref: meshName ? { id: entity, name: meshName } : { id: entity },
  };
}

/** Records viewport pointing, clicks into the running scene, player movement and play modes. */
export function trackRenderer({
  engine,
  renderer,
  emit,
  now = Date.now,
  pointerDwellMs = 200,
  playerMinIntervalMs = 1000,
  playerMinDistance = 0.5,
  describeTimeoutMs = 1500,
}: RendererTrackerOptions): StopTracker {
  const unsubscribes: Unsubscribe[] = [];
  type PendingPointer = {
    entity: Entity | null;
    meshName?: string;
    point?: Vec3;
    prefix: string;
    t: number;
  };
  let pendingPointer: PendingPointer | null = null;
  let pointerTimer: ReturnType<typeof setTimeout> | null = null;
  let lastPointerText = '';
  let lastPlayer: { position: Vec3; t: number } | null = null;
  let playerPosition: Vec3 | null = null;
  let stopped = false;

  // Interact mode on a paused scene isn't "playing": after a Stop/reset the scene is frozen
  // but viewport clicks still bypass editing, and the timeline should say so.
  const prefix = () => {
    if (renderer.sceneRun?.isRunning() === true) return 'While playing: ';
    if (renderer.interaction?.isEditingEnabled() === false)
      return 'In Interact mode (scene paused): ';
    return '';
  };
  const at = (point?: Vec3) => (point ? ` at ${formatVector(point, 1)}` : '');

  const needsLookup = (entity: Entity) =>
    renderer.activity?.describeEntity !== undefined && isCodeCreated(engine, entity);

  // An entity the scene's code created is described by what it looks like, asked of the running
  // scene ("a red box created by the scene's code (#1043)"); the id alone means nothing.
  async function describeTarget(
    entity: Entity,
    meshName?: string,
  ): Promise<{ text: string; ref: EntityRef }> {
    const plain = describeRendererEntity(engine, entity, meshName);
    const describe = renderer.activity?.describeEntity;
    if (!describe || !isCodeCreated(engine, entity)) return plain;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const looks = await Promise.race([
      describe(entity).catch(() => null),
      new Promise<null>(resolve => {
        timeout = setTimeout(() => resolve(null), describeTimeoutMs);
      }),
    ]);
    clearTimeout(timeout);
    if (!looks) return plain;
    return {
      text: `${looks} created by the scene's code (#${entity})`,
      ref: { id: entity, name: shortName(looks) },
    };
  }

  function emitPointer(pending: PendingPointer, target: { text: string; ref: EntityRef } | null) {
    const text = target
      ? `${pending.prefix}Pointer over ${target.text} in the viewport${at(pending.point)}`
      : `${pending.prefix}Pointer over nothing in the viewport`;
    if (text === lastPointerText) return;
    lastPointerText = text;
    emit({
      t: pending.t,
      kind: 'viewport-hover',
      area: 'Viewport',
      text,
      ...(target && { entity: target.ref }),
    });
  }

  function flushPointer() {
    pointerTimer = null;
    const pending = pendingPointer;
    pendingPointer = null;
    if (!pending) return;
    if (pending.entity === null) {
      emitPointer(pending, null);
      return;
    }
    if (!needsLookup(pending.entity)) {
      emitPointer(pending, describeRendererEntity(engine, pending.entity, pending.meshName));
      return;
    }
    void describeTarget(pending.entity, pending.meshName).then(target => {
      if (!stopped) emitPointer(pending, target);
    });
  }

  function onSceneChange(change: SceneEntityChange) {
    const verb = change.change === 'appeared' ? 'appeared' : 'disappeared';
    let where = '';
    if (change.position) {
      where = ` at ${formatVector(change.position, 1)}`;
      if (playerPosition) {
        where += `, ${Math.round(distance(change.position, playerPosition))} m from the player`;
      }
    }
    const text =
      change.count > 1
        ? `${prefix()}${change.count} entities ${verb}, each ${change.description}`
        : `${prefix()}${capitalize(change.description)}${change.entity !== null ? ` (#${change.entity})` : ''} ${verb}${where}`;
    emit({
      ...(change.at !== undefined && { t: change.at }),
      kind: change.change === 'appeared' ? 'scene-appear' : 'scene-remove',
      area: 'Viewport',
      text,
      ...(change.entity !== null && {
        entity: { id: change.entity, name: shortName(change.description) },
      }),
    });
  }

  function onActivity(activity: RendererActivity) {
    if (activity.kind === 'pointerTarget') {
      if (pointerTimer) clearTimeout(pointerTimer);
      pendingPointer = {
        entity: activity.entity,
        meshName: activity.meshName,
        point: activity.point,
        prefix: prefix(),
        t: now(),
      };
      pointerTimer = setTimeout(flushPointer, pointerDwellMs);
      return;
    }
    if (activity.kind === 'sceneClick') {
      const t = now();
      const p = prefix();
      const send = (target: { text: string; ref: EntityRef } | null) =>
        emit({
          t,
          kind: 'scene-click',
          area: 'Viewport',
          text: `${p}Clicked ${target ? target.text : 'nothing'} in the running scene${at(activity.point)}`,
          ...(target && { entity: target.ref }),
        });
      if (activity.entity === null) send(null);
      else if (!needsLookup(activity.entity))
        send(describeRendererEntity(engine, activity.entity, activity.meshName));
      else
        void describeTarget(activity.entity, activity.meshName).then(target => {
          if (!stopped) send(target);
        });
      return;
    }
    if (activity.kind === 'sceneEntities') {
      onSceneChange(activity);
      return;
    }
    playerPosition = activity.position;
    const t = now();
    if (
      lastPlayer &&
      (t - lastPlayer.t < playerMinIntervalMs ||
        distance(lastPlayer.position, activity.position) < playerMinDistance)
    ) {
      return;
    }
    lastPlayer = { position: activity.position, t };
    emit({
      t,
      kind: 'player',
      area: 'Viewport',
      text: `${prefix()}Player at ${formatVector(activity.position, 1)}`,
    });
  }

  if (renderer.activity) unsubscribes.push(renderer.activity.track(onActivity));

  if (renderer.sceneRun) {
    unsubscribes.push(
      renderer.sceneRun.onRunChange(running =>
        emit({ kind: 'mode', text: running ? 'Started playing the scene' : 'Paused the scene' }),
      ),
    );
  }
  if (renderer.interaction) {
    unsubscribes.push(
      renderer.interaction.onEditingChange(enabled =>
        emit({
          kind: 'mode',
          text: enabled
            ? 'Turned off Interact mode (viewport clicks select and move entities again)'
            : 'Turned on Interact mode (viewport clicks reach the running scene)',
        }),
      ),
    );
  }
  if (renderer.editorCamera) {
    unsubscribes.push(
      renderer.editorCamera.onModeChange(mode =>
        emit({
          kind: 'mode',
          text:
            mode === 'free'
              ? 'Switched to the free editor camera'
              : 'Switched to the player (avatar) camera',
        }),
      ),
    );
  }
  if (renderer.audio) {
    unsubscribes.push(
      renderer.audio.onMuteChange(muted =>
        emit({ kind: 'mode', text: muted ? 'Muted the scene audio' : 'Unmuted the scene audio' }),
      ),
    );
  }
  let worldAligned = renderer.gizmos.isWorldAligned();
  unsubscribes.push(
    renderer.gizmos.onChange(() => {
      const next = renderer.gizmos.isWorldAligned();
      if (next === worldAligned) return;
      worldAligned = next;
      emit({
        kind: 'mode',
        text: `Switched the gizmo to ${next ? 'world' : 'local'} alignment`,
      });
    }),
  );

  return () => {
    unsubscribes.forEach(unsubscribe => unsubscribe());
    if (pointerTimer) clearTimeout(pointerTimer);
    // Stopping can't wait for the running scene: a target still pending is named plainly.
    const pending = pendingPointer;
    if (pending && now() - pending.t >= pointerDwellMs) {
      emitPointer(
        pending,
        pending.entity === null
          ? null
          : describeRendererEntity(engine, pending.entity, pending.meshName),
      );
    }
    pendingPointer = null;
    stopped = true;
  };
}
