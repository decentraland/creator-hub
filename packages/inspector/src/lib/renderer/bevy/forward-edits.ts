import type { ComponentDefinition, Entity } from '@dcl/ecs';
import { CrdtMessageType } from '@dcl/ecs';

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
 * `set_component` addresses them by the bare `Transform`. Only components listed
 * here are forwarded (see the deferral note above).
 */
const ENGINE_COMPONENT_NAMES: Record<string, string> = {
  'core::Transform': 'Transform',
};

export interface ForwardEditBridgeOptions {
  /** The renderer's scene context — the source of ECS changes to forward. */
  context: Pick<BevySceneContext, 'onChange'>;
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
        fire(`delete_entity ${entity}`, 'delete_entity', [String(entity)]);
        return;
      }
      if (!component) return;

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
      // Prefer the onChange value; fall back to a live read if absent. The base
      // ComponentDefinition type doesn't surface getOrNull (it's on the LWW
      // subtype), so narrow for the fallback read.
      const readable = component as { getOrNull?: (e: Entity) => unknown };
      const current = value ?? readable.getOrNull?.(entity);
      if (current == null) return;
      fire(`set_component ${entity} ${engineName}`, 'set_component', [
        String(entity),
        engineName,
        JSON.stringify(current),
      ]);
    },
  );

  return () => {
    if (armTimer !== null) clearTimeout(armTimer);
    off();
  };
}
