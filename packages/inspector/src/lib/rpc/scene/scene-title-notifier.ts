import type { Emitter } from 'mitt';
import type { Entity } from '@dcl/ecs';

import type { SdkContextEvents } from '../../sdk/context';

const SCENE_METADATA_PREFIX = 'inspector::SceneMetadata';

/**
 * Reports the scene's display title to the host whenever the root entity's SceneMetadata
 * changes in the inspector engine (any schema version, since the data-layer may stream an
 * older one). The host otherwise learns of a rename only from the scene.json write passing
 * through its own storage RPC, which never happens when the data-layer is the realm's
 * WebSocket (Bevy) — so its header kept the old name until the scene was reopened.
 */
export function createSceneTitleNotifier(
  events: Emitter<SdkContextEvents>,
  rootEntity: Entity,
  notify: (title: string) => Promise<unknown> | undefined,
): () => void {
  let lastSent: string | undefined;
  const onChange = ({ entity, component, value }: SdkContextEvents['change']) => {
    if (entity !== rootEntity || !component?.componentName.startsWith(SCENE_METADATA_PREFIX)) {
      return;
    }
    const title = typeof value?.name === 'string' ? value.name : undefined;
    if (title === undefined || title === lastSent) return;
    lastSent = title;
    void notify(title)?.catch(() => {
      // Older hosts don't implement notify_scene_metadata; their header refreshes on reopen.
    });
  };
  events.on('change', onChange);
  return () => events.off('change', onChange);
}
