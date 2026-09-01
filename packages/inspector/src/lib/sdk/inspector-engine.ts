import mitt from 'mitt';

import { createEngineContext } from '../data-layer/host/utils/engine';
import { createFloorEntityContainer } from './entity-id-floor';
import type { SdkContextEvents, SdkContextValue } from './context';

export function createInspectorEngine(): Omit<
  SdkContextValue,
  'operations' | 'enumEntity' | 'renderer' | 'currentRendererId'
> {
  const events = mitt<SdkContextEvents>();
  const { engine, components } = createEngineContext({
    // Allocate new authored entities above the active renderer's live-entity floor so
    // they can't collide with runtime code entities (#1468). Transparent when no
    // renderer publishes a floor (Babylon / boot).
    entityContainer: createFloorEntityContainer(),
    onChangeFunction: (entity, operation, component, value) =>
      events.emit('change', { entity, operation, component, value }),
  });

  function dispose() {
    // outgoingMessagesStream.close()
    events.emit('dispose');
  }
  return {
    engine,
    components,
    events,
    dispose,
  };
}
