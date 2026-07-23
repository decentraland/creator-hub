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
  'core::Animator': 'Animator',
};

export interface ForwardEditBridgeOptions {
  /**
   * The renderer's scene context — the source of ECS changes to forward, plus the
   * `Name` component (to instantiate a new entity via `/new_entity`; see below).
   */
  context: Pick<
    BevySceneContext,
    'onChange' | 'Name' | 'getForwardableComponent' | 'editorComponents' | 'engine'
  >;
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
  /**
   * Whether the scene is currently frozen (paused). Read when forwarding arms so
   * animations that loaded playing are paused to match the editor's default-frozen
   * state (#1382). Defaults to frozen (the editor boots static).
   */
  isFrozen?: () => boolean;
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
export interface ForwardEditBridge {
  /** Tear down the change subscription + arm timer. */
  disconnect(): void;
  /** Pause (frozen=true) or resume (false) GLTF animation playback by forwarding
   * each animated entity's Animator with playing:false, or the authored value
   * (#1382). Driven by the scene run/freeze toggle. */
  setAnimationsFrozen(frozen: boolean): void;
  /** Re-establish editor overrides after a scene reload (Stop/#1376), which
   * re-creates the engine entities: marks existing entities instantiated (no
   * re-`new_entity` → no id collision) and replays placeholder/visibility/pickable/
   * animation overrides so they survive the reload. */
  reconcileAfterReload(): void;
}

export function createForwardEditBridge(options: ForwardEditBridgeOptions): ForwardEditBridge {
  const { context, engineWindow } = options;
  // Default frozen — the editor boots static (see setAnimationsFrozen / #1382).
  const isFrozen = options.isFrozen ?? (() => true);
  const send =
    options.send ?? ((cmd: string, args: string[]) => consoleCommand(engineWindow, cmd, args));
  const onError =
    options.onError ??
    ((ctx: string, error: unknown) => {
      // eslint-disable-next-line no-console
      console.warn(`[bevy] forward edit failed (${ctx}):`, error);
    });

  // The load burst is suppressed (shouldForward === false), so the editor's
  // component-derived overrides never reach the engine on load. Once forwarding
  // arms, replay them for every entity whose engine render must differ from what
  // it loaded:
  //  - editor `Hide` set  → force invisible (else it'd load visible)
  //  - authored VisibilityComponent{visible:false} → force VISIBLE in the editor
  //    (#1377; else it'd load invisible and be unselectable)
  //  - editor `Placeholder` → render its GLTF (#1372; a model-less item like a
  //    Trigger Area is otherwise invisible in the editor)
  // The forward* helpers compute the right value for each; we just touch every
  // candidate entity once.
  const reconcileEditorOverridesOnArm = () => {
    const Hide = context.editorComponents.Hide;
    const seen = new Set<Entity>();
    for (const [entity, hide] of context.engine.getEntitiesWith(Hide)) {
      if ((hide as { value?: boolean } | undefined)?.value && !seen.has(entity)) {
        seen.add(entity);
        forwardEditorVisibility(entity);
      }
    }
    const visComp = context.getForwardableComponent('core::VisibilityComponent');
    if (visComp) {
      for (const [entity, v] of context.engine.getEntitiesWith(visComp)) {
        if ((v as { visible?: boolean } | undefined)?.visible === false && !seen.has(entity)) {
          seen.add(entity);
          forwardEditorVisibility(entity);
        }
      }
    }
    for (const [entity] of context.engine.getEntitiesWith(context.editorComponents.Placeholder)) {
      forwardPlaceholder(entity, false);
    }
    // #1373: re-forward each loaded GltfContainer so forwardSet re-applies the
    // editor's pointer-pickable mask — a model saved without a pointer collider is
    // otherwise unclickable after a reload (the load burst that carried its
    // authored mask was suppressed).
    const gltf = context.getForwardableComponent(GLTF_CONTAINER);
    if (gltf) {
      for (const [entity, current] of context.engine.getEntitiesWith(gltf)) {
        enqueue(entity, async () => {
          await ensureInstantiated(entity);
          await forwardSet(entity, 'GltfContainer', current);
        });
      }
    }
    // #1382: the editor boots frozen, but a scene loads with its Animator clips
    // playing — pause them to match the frozen state (setAnimationsFrozen forwards
    // playing:false; the toolbar toggle later resumes/re-pauses).
    if (isFrozen()) setAnimationsFrozen(true);
  };

  // Arm after a delay so the initial CRDT load burst is not forwarded (see
  // ARM_DELAY_MS). Overridable for tests.
  let armed = false;
  const armTimer = options.shouldForward
    ? null
    : setTimeout(() => {
        armed = true;
        reconcileEditorOverridesOnArm();
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

  // What visibility the ENGINE should render for an entity in the editor, which
  // is NOT the entity's authored VisibilityComponent. Two editor rules override
  // the scene's runtime visibility, both mirroring the Babylon editor:
  //
  //  1. Editor `Hide` (the tree eye-icon) — an inspector-only component with no
  //     engine counterpart. When Hide is true the entity is invisible in the
  //     viewport (Babylon: setEnabled(false)).
  //  2. Authored `VisibilityComponent{visible:false}` (#1377) — a runtime concern
  //     the editor IGNORES so the entity stays visible/selectable while editing
  //     (Babylon has no VisibilityComponent handler at all, so it never hides).
  //     Preview/live still hide it: the CRDT keeps the authored value; we only
  //     override what the ENGINE renders.
  //
  // So the effective editor visibility is simply: visible unless Hide is set.
  // Forward that as the engine's VisibilityComponent. Existing scene entities
  // already live in the engine, so we never `/new_entity` here — ensureInstantiated
  // only matters for a NEW entity edited before its model instantiates (a no-op
  // for entities the engine already loaded).
  const forwardEditorVisibility = (entity: Entity) => {
    const hideValue = context.editorComponents.Hide.getOrNull(entity) as
      | { value?: boolean }
      | null
      | undefined;
    const visible = !hideValue?.value;
    enqueue(entity, async () => {
      await ensureInstantiated(entity);
      await forwardSet(entity, 'VisibilityComponent', { visible });
    });
  };

  // Editor `Placeholder` (#1372) — an inspector-only component `{ src }` holding a
  // GLTF that stands in for an otherwise-invisible item (e.g. a Trigger Area) so
  // it can be seen/selected in the editor but NOT in preview. The engine has no
  // Placeholder component, so translate it to a `GltfContainer` pointed at the
  // placeholder src. Only forward it when the entity has no AUTHORED GltfContainer
  // (a real model already renders; the placeholder is for model-less items) — else
  // we'd clobber the real model. Editor-only: the CRDT keeps just the Placeholder
  // component, so preview (which ignores editor components) never shows it.
  const GLTF_CONTAINER = 'core::GltfContainer';
  const forwardPlaceholder = (entity: Entity, deleted: boolean) => {
    const authoredGltf = context.getForwardableComponent(GLTF_CONTAINER) as {
      getOrNull?: (e: Entity) => unknown;
    } | null;
    // A real authored model wins — never override it with a placeholder.
    if (authoredGltf?.getOrNull?.(entity) != null) return;
    const placeholder = deleted
      ? null
      : (context.editorComponents.Placeholder.getOrNull(entity) as { src?: string } | null);
    enqueue(entity, async () => {
      await ensureInstantiated(entity);
      if (placeholder?.src) {
        await forwardSet(entity, 'GltfContainer', { src: placeholder.src });
      } else {
        fire(`delete_component ${entity} GltfContainer`, 'delete_component', [
          String(entity),
          'GltfContainer',
        ]);
      }
    });
  };

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
            // VisibilityComponent is decided by the editor, not the authored value
            // (see forwardEditorVisibility) — forward it separately, below.
            if (engineName === 'VisibilityComponent') continue;
            const c = context.getForwardableComponent(ecsName) as {
              getOrNull?: (e: Entity) => unknown;
            } | null;
            const v = c?.getOrNull?.(entity);
            if (v != null) await forwardSet(entity, engineName, v);
          }
        });
        // Always assert the editor's effective visibility for a new entity (visible
        // unless Hidden) — overriding any authored VisibilityComponent{false}.
        forwardEditorVisibility(entity);
        // A new entity that carries a Placeholder (and no authored model) — render
        // its placeholder GLTF (a dropped Trigger Area etc.).
        if (context.editorComponents.Placeholder.getOrNull(entity) != null) {
          forwardPlaceholder(entity, false);
        }
        return;
      }

      // Editor `Hide` OR authored `VisibilityComponent` → the editor's effective
      // visibility (see forwardEditorVisibility). Both are re-derived there, so a
      // change to either just re-asserts the computed value.
      if (
        component.componentName === context.editorComponents.Hide.componentName ||
        component.componentName === 'core::VisibilityComponent'
      ) {
        forwardEditorVisibility(entity);
        return;
      }

      // Editor `Placeholder` → engine GltfContainer (see forwardPlaceholder): shows
      // the placeholder GLTF in the editor for model-less items (Trigger Area etc).
      if (component.componentName === context.editorComponents.Placeholder.componentName) {
        forwardPlaceholder(entity, op === CrdtMessageType.DELETE_COMPONENT);
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
      // An Animator PUT that arrives WHILE THE SCENE IS FROZEN must be forced to
      // playing:false, not forwarded as-is. After a Stop/reload the scene's GLTFs
      // re-load and re-PUT their Animator with the authored playing:true — which
      // would resume the animation a beat after the freeze (#1421: "animations run
      // for a couple frames after stop"). Route it through forwardAnimatorFrozen so
      // a frozen scene's clips stay paused; when unfrozen it forwards as-is.
      if (engineName === 'Animator' && isFrozen()) {
        forwardAnimatorFrozen(entity, current, true);
        return;
      }
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
    let payload = current;
    if (engineName === 'GltfContainer') {
      // #1373: in the EDITOR, force all visible meshes to be pointer-pickable so a
      // model without an authored pointer collider can still be clicked to select
      // it (matching Babylon, where every visible mesh is pickable). CL_POINTER is
      // bit 1; OR it into visibleMeshesCollisionMask. Editor-only — the CRDT keeps
      // the authored mask, so preview/live collision is unchanged.
      const CL_POINTER = 1;
      const g = (current ?? {}) as { visibleMeshesCollisionMask?: number };
      payload = {
        ...g,
        visibleMeshesCollisionMask: (g.visibleMeshesCollisionMask ?? 0) | CL_POINTER,
      };
      try {
        await send('scene_content', []);
      } catch (error) {
        onError(`scene_content (before ${entity} GltfContainer)`, error);
      }
    }
    const setArgs = [String(entity), engineName, JSON.stringify(payload)];
    try {
      await send('set_component', setArgs);
    } catch (error) {
      onError(`set_component ${entity} ${engineName}`, error);
    }
  }

  // #1382: pause/resume GLTF animation playback with the scene freeze. Freezing
  // stops the SDK7 tick but the engine's AnimationPlayers keep advancing GLTF
  // clips (update_animations sets each clip's speed from Animator.states[].playing
  // — playing:false → speed 0). So while FROZEN, forward every animated entity's
  // Animator with all states playing:false (engine pauses the clips); on UNFREEZE,
  // re-forward the AUTHORED Animator so it resumes as the scene intends. The CRDT
  // keeps the authored value — this only changes what the engine plays.
  const forwardAnimatorFrozen = (entity: Entity, animator: unknown, frozen: boolean) => {
    const a = animator as { states?: Array<Record<string, unknown>> } | null | undefined;
    const value = frozen ? { states: (a?.states ?? []).map(s => ({ ...s, playing: false })) } : a;
    if (value == null) return;
    enqueue(entity, async () => {
      await ensureInstantiated(entity);
      await forwardSet(entity, 'Animator', value);
    });
  };

  const setAnimationsFrozen = (frozen: boolean) => {
    const Animator = context.getForwardableComponent('core::Animator');
    if (!Animator) return;
    for (const [entity, animator] of context.engine.getEntitiesWith(Animator)) {
      forwardAnimatorFrozen(entity, animator, frozen);
    }
  };

  // Re-establish the editor overrides after a scene `reload` (Stop/#1376). The
  // reload RE-CREATES the scene's engine entities at their original ids, so:
  //  - every Name-bearing entity already exists in the engine again — mark them
  //    instantiated so the re-forward doesn't `/new_entity` them (which collides:
  //    "id 512 already live") and drop the placeholder/visibility override (the
  //    bug where a Trigger Area's placeholder vanished after Stop and never came
  //    back), and
  //  - the fresh entities lost the forwarded overrides (placeholder GLTF, editor
  //    visibility, pointer-pickable mask, animation pause) — replay them.
  const reconcileAfterReload = () => {
    for (const [entity] of context.engine.getEntitiesWith(context.Name)) {
      instantiated.add(entity);
    }
    reconcileEditorOverridesOnArm();
  };

  return {
    disconnect: () => {
      if (armTimer !== null) clearTimeout(armTimer);
      off();
    },
    setAnimationsFrozen,
    reconcileAfterReload,
  };
}
