import type { Emitter } from 'mitt';
import type { Entity, TransformType } from '@dcl/ecs';

import type { RendererEvents } from '../types';
import type { EngineWindow } from './console';
import { consoleCommand } from './console';

/**
 * Live gizmo-drag preview for the Bevy renderer.
 *
 * A gizmo drag emits `previewTransforms` every frame (absolute Transforms the
 * inspector already merged, but did NOT write to the CRDT — so no undo entry per
 * frame). The Bevy engine only updates via console commands, so this pushes each
 * as `set_component <entity> Transform <json>` directly, exactly like the
 * forward-edit bridge does for committed edits. The entity therefore tracks the
 * gizmo continuously; the authoritative CRDT write still happens once, on the
 * drag-end `gizmoCommit` (which the forward-edit bridge then forwards as usual).
 *
 * The console `set_component Transform` REPLACES the whole component, which is why
 * the preview carries the full merged Transform (position + rotation + scale +
 * parent), not just the changed field — a partial write would clobber the rest.
 */

export interface PreviewBridgeOptions {
  /** The renderer's event emitter (source of `previewTransforms`). */
  events: Emitter<RendererEvents>;
  /** The live engine window to send console commands to. */
  engineWindow: EngineWindow;
  /**
   * Test seam: send a console command. Defaults to the real `consoleCommand`
   * against `engineWindow`. Tests inject a recorder.
   */
  send?: (cmd: string, args: string[]) => Promise<string>;
  /** Test seam: how a failed preview command is reported. */
  onError?: (context: string, error: unknown) => void;
}

/** Serialize a merged preview into the engine's Transform component JSON — the
 * SAME shape the forward-edit bridge sends for a committed edit (full component,
 * including parent, since `set_component` replaces the whole Transform). */
function transformJson(t: RendererEvents['previewTransforms']['transforms'][number]): string {
  const value: Partial<TransformType> = {
    position: t.position,
    rotation: t.rotation,
    scale: t.scale,
    ...(t.parent !== undefined ? { parent: t.parent } : {}),
  };
  return JSON.stringify(value);
}

/** Wire `previewTransforms` → engine `set_component`. Returns a disconnect fn. */
export function createPreviewBridge(options: PreviewBridgeOptions): () => void {
  const { events, engineWindow } = options;
  const send =
    options.send ?? ((cmd: string, args: string[]) => consoleCommand(engineWindow, cmd, args));
  const onError =
    options.onError ??
    ((ctx: string, error: unknown) => {
      // eslint-disable-next-line no-console
      console.warn(`[bevy] gizmo preview failed (${ctx}):`, error);
    });

  const onPreview = ({ transforms }: RendererEvents['previewTransforms']) => {
    for (const t of transforms) {
      const entity = t.entity as Entity as number;
      void send('set_component', [String(entity), 'Transform', transformJson(t)]).catch(error =>
        onError(`set_component ${entity} Transform`, error),
      );
    }
  };

  events.on('previewTransforms', onPreview);
  return () => events.off('previewTransforms', onPreview);
}
