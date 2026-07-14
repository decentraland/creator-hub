import type { ComponentDefinition, Entity } from '@dcl/ecs';
import { CrdtMessageType } from '@dcl/ecs';
import { ReadWriteByteBuffer } from '@dcl/ecs/dist/serialization/ByteBuffer';

import type { EngineWindow } from './console';
import { consoleCommand } from './console';
import type { BevySceneContext } from './BevySceneContext';

/**
 * Forward edit bridge: inspector ECS changes → engine console commands.
 *
 * The bevy engine renders a scene it loaded from the realm; that scene is static
 * once loaded, with **no live CRDT channel back in**. The only way to mutate the
 * running scene is the engine's console (`set_component` / `delete_component` /
 * `delete_entity`) — exactly how bevy-editor edits (see its `writeComponent`).
 *
 * So we translate the inspector's authoritative ECS changes into those commands:
 * subscribe to the context's change stream and, for each supported component,
 * push a `set_component`. This is the forward half of editing; the reverse
 * channel (viewport pick / gizmo → inspector) is a separate slice.
 *
 * Scope (first slice): **engine-managed components addressed by short name**,
 * starting with Transform — the one moving/rotating/scaling produces, enough to
 * prove edits show live in Bevy. Custom/schema components (`core-schema::Name`,
 * `asset-packs::…`) need `set_component_raw` by numeric id and are deferred; we
 * skip anything not in the engine-name map rather than mis-send it as
 * `set_component` (which the engine would reject).
 */

/**
 * Map from an `@dcl/ecs` `componentName` to the engine's console component name.
 * `@dcl/ecs` reports engine-managed components as `core::Transform`; the engine's
 * `set_component` addresses them by the bare `Transform` (its ComponentNameRegistry
 * registers each proto component by that PascalCase name). Only components listed
 * here are forwarded; anything else (asset-packs::, core-schema:: like Name, and
 * other custom/schema components) is skipped rather than mis-sent as `set_component`
 * (the engine would reject an unknown name).
 *
 * These are the CORE VISUAL components — enough for a dropped/added model to appear
 * live in the engine (writing GltfContainer to a fresh entity id creates the entity
 * in the CRDT store and the engine's gltf loader renders it) without a full reload.
 * `Name` is intentionally omitted: it's `core-schema::Name` (a schema component the
 * registry doesn't expose by name), and it's only the tree label — the model renders
 * without it.
 */
const ENGINE_COMPONENT_NAMES: Record<string, string> = {
  'core::Transform': 'Transform',
  'core::GltfContainer': 'GltfContainer',
  'core::MeshRenderer': 'MeshRenderer',
  'core::MeshCollider': 'MeshCollider',
  'core::Material': 'Material',
  'core::VisibilityComponent': 'VisibilityComponent',
  'core::Billboard': 'Billboard',
  'core::TextShape': 'TextShape',
};

export interface ForwardEditBridgeOptions {
  /**
   * The renderer's scene context — the source of ECS changes to forward, plus the
   * `Name` component (to instantiate a new entity via `/new_entity`; see below).
   */
  context: Pick<BevySceneContext, 'onChange' | 'Name' | 'getForwardableComponent'>;
  /** The live engine window to send console commands to. */
  engineWindow: EngineWindow;
  /**
   * Test seam: send a console command. Defaults to the real `consoleCommand`
   * against `engineWindow`. Tests inject a recorder.
   */
  send?: (cmd: string, args: string[]) => Promise<string>;
  /** Test seam: how a failed forward command is reported. */
  onError?: (context: string, error: unknown) => void;
  /**
   * Gate: forward a change only when this returns true. Defaults to a settle
   * window (see {@link SETTLE_QUIET_MS}). Tests pass `() => true` to forward
   * immediately.
   */
  shouldForward?: () => boolean;
}

/**
 * The engine loads the whole scene from the realm on boot, so the inspector's
 * initial CRDT sync is a large burst of PUT_COMPONENTs the engine ALREADY has —
 * replaying them as `set_component` is redundant, floods the console, and (with
 * no scene pinned yet) every one is rejected "player is not in any scene",
 * wedging boot. bevy-editor avoids this by only forwarding explicit *user* edits,
 * never the initial snapshot. We have no per-change "user vs load" signal, so we
 * arm forwarding only after this delay from bridge start — the initial load
 * arrives immediately on connect; genuine user edits come much later.
 */
const ARM_DELAY_MS = 3000;

/**
 * Wire the inspector's ECS changes to engine console writes. Returns a
 * disconnect fn.
 *
 * Engine writes are fire-and-forget async; a failed command is logged (via
 * `onError`) but never throws into the ECS change loop — a dropped edit must not
 * wedge the inspector.
 */
export function createForwardEditBridge(options: ForwardEditBridgeOptions): () => void {
  const { context, engineWindow } = options;
  const send =
    options.send ?? ((cmd: string, args: string[]) => consoleCommand(engineWindow, cmd, args));
  const onError =
    options.onError ??
    ((ctx: string, error: unknown) => {
      // eslint-disable-next-line no-console
      console.warn(`[bevy] forward edit failed (${ctx}):`, error);
    });

  // Arm after a delay so the initial CRDT load burst is not forwarded (see
  // ARM_DELAY_MS). Overridable for tests.
  let armed = false;
  const armTimer = options.shouldForward
    ? null
    : setTimeout(() => {
        armed = true;
      }, ARM_DELAY_MS);
  const shouldForward = options.shouldForward ?? (() => armed);

  const fire = (label: string, cmd: string, args: string[]) => {
    void send(cmd, args).catch(error => onError(label, error));
  };

  // Entities we've instantiated in the engine scene (via `/new_entity`). A NEW
  // entity (e.g. a dropped asset) doesn't exist in the engine's scene, so writing
  // its engine components (Transform/GltfContainer) is rejected as "missing
  // entity" — the model never appears. We detect a new entity by its `Name` PUT
  // (asset-add always writes Name; editing an existing entity never does),
  // instantiate it, then (re)send its engine components. A per-entity serial chain
  // keeps operations ordered (instantiate → set_component → …).
  const instantiated = new Set<Entity>();
  const queues = new Map<Entity, Promise<unknown>>();
  const enqueue = (entity: Entity, task: () => Promise<void>) => {
    const prev = queues.get(entity) ?? Promise.resolve();
    const next = prev.then(task).catch(() => {});
    queues.set(entity, next);
  };

  const NAME_COMPONENT = context.Name.componentName; // 'core-schema::Name'

  /** Base64 of the entity's Name serialized with its SDK schema (for `/new_entity`). */
  const encodeName = (v: unknown): string => {
    const buf = new ReadWriteByteBuffer();
    context.Name.schema.serialize(v as never, buf);
    let binary = '';
    for (const byte of buf.toBinary()) binary += String.fromCharCode(byte);
    return btoa(binary);
  };

  /** Instantiate a new entity in the engine scene at its exact id, anchored by its
   * Name (a custom component — `/new_entity` requires one; engine components flow
   * one-way and can't create an entity). No-op if already instantiated. */
  const ensureInstantiated = async (entity: Entity): Promise<void> => {
    if (instantiated.has(entity)) return;
    const name = context.Name.getOrNull(entity);
    if (name == null) return; // no Name yet — can't anchor; a later Name PUT will
    instantiated.add(entity);
    const data = encodeName(name);
    try {
      await send('new_entity', [
        String(context.Name.componentId),
        data,
        '0',
        '--ids',
        String(entity),
      ]);
    } catch (error) {
      instantiated.delete(entity); // let a retry re-attempt
      onError(`new_entity ${entity}`, error);
    }
  };

  const off = context.onChange(
    (
      entity: Entity,
      op: CrdtMessageType,
      component?: ComponentDefinition<unknown>,
      value?: unknown,
    ) => {
      // Suppress the initial load burst; forward only once armed.
      if (!shouldForward()) return;
      if (op === CrdtMessageType.DELETE_ENTITY) {
        instantiated.delete(entity);
        fire(`delete_entity ${entity}`, 'delete_entity', [String(entity)]);
        return;
      }
      if (!component) return;

      // A Name PUT marks a (new) entity — instantiate it in the engine scene, then
      // (re)send the engine components it already carries, since they typically
      // arrive in the same batch BEFORE the Name (and were rejected as "missing
      // entity"). Editing an existing entity never writes Name, so this only fires
      // for genuinely new entities.
      if (op === CrdtMessageType.PUT_COMPONENT && component.componentName === NAME_COMPONENT) {
        enqueue(entity, async () => {
          await ensureInstantiated(entity);
          for (const [ecsName, engineName] of Object.entries(ENGINE_COMPONENT_NAMES)) {
            const c = context.getForwardableComponent(ecsName) as {
              getOrNull?: (e: Entity) => unknown;
            } | null;
            const v = c?.getOrNull?.(entity);
            if (v != null) await forwardSet(entity, engineName, v);
          }
        });
        return;
      }

      const engineName = ENGINE_COMPONENT_NAMES[component.componentName];
      // Deferred (custom/schema) components: skip rather than mis-address them.
      if (!engineName) return;

      if (op === CrdtMessageType.DELETE_COMPONENT) {
        fire(`delete_component ${entity} ${engineName}`, 'delete_component', [
          String(entity),
          engineName,
        ]);
        return;
      }

      // PUT_COMPONENT (and its NETWORK variant): write the current value as JSON.
      // Prefer the onChange value; fall back to a live read if absent.
      const readable = component as { getOrNull?: (e: Entity) => unknown };
      const current = value ?? readable.getOrNull?.(entity);
      if (current == null) return;
      // Serialize the forward so a component arriving before its entity's Name PUT
      // still lands (the Name PUT's re-send will cover it if this one raced the
      // instantiation). Instantiate-if-needed keeps a lone engine edit on a new
      // entity working even without a Name (best effort; usually Name drives it).
      enqueue(entity, async () => {
        await ensureInstantiated(entity);
        await forwardSet(entity, engineName, current);
      });
    },
  );

  /** Send one engine component, refreshing the content map first for GltfContainer
   * (its `src` points at a project file the engine must be able to resolve). */
  async function forwardSet(entity: Entity, engineName: string, current: unknown): Promise<void> {
    const setArgs = [String(entity), engineName, JSON.stringify(current)];
    if (engineName === 'GltfContainer') {
      try {
        await send('scene_content', []);
      } catch (error) {
        onError(`scene_content (before ${entity} GltfContainer)`, error);
      }
    }
    try {
      await send('set_component', setArgs);
    } catch (error) {
      onError(`set_component ${entity} ${engineName}`, error);
    }
  }

  return () => {
    if (armTimer !== null) clearTimeout(armTimer);
    off();
  };
}
