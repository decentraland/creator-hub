import type { Emitter } from 'mitt';
import type { Entity } from '@dcl/ecs';

import type { SdkContextEvents } from '../../sdk/context';
import { getValidParcels } from '../../data-layer/host/utils/component';
import type { SceneMetadataNotice } from './client';

const SCENE_METADATA_PREFIX = 'inspector::SceneMetadata';

type Coords = { x: number; y: number };

const toParcel = ({ x, y }: Coords) => `${x},${y}`;

const ignoreHostWithoutNotifySupport = () => {};

/** Reports the root SceneMetadata title and parcel layout to the host as they change. */
export function createSceneMetadataNotifier(
  events: Emitter<SdkContextEvents>,
  rootEntity: Entity,
  notify: (metadata: SceneMetadataNotice) => Promise<unknown> | undefined,
): () => void {
  let lastSent: string | undefined;
  const onChange = ({ entity, component, value }: SdkContextEvents['change']) => {
    if (entity !== rootEntity || !component?.componentName.startsWith(SCENE_METADATA_PREFIX)) {
      return;
    }
    if (typeof value?.name !== 'string') return;
    const layout = value.layout as { base?: Coords; parcels?: Coords[] } | undefined;
    const metadata: SceneMetadataNotice = {
      title: value.name,
      scene: getValidParcels(
        layout?.parcels?.map(toParcel),
        layout?.base ? toParcel(layout.base) : undefined,
      ),
    };
    const key = JSON.stringify(metadata);
    if (key === lastSent) return;
    lastSent = key;
    void notify(metadata)?.catch(ignoreHostWithoutNotifySupport);
  };
  events.on('change', onChange);
  return () => events.off('change', onChange);
}
