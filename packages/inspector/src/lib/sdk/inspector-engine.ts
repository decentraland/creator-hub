import mitt from 'mitt';

import { createEngineContext } from '../data-layer/host/utils/engine';
import type { SdkContextEvents, SdkContextValue } from './context';

export function createInspectorEngine(): Omit<
  SdkContextValue,
  | 'scene'
  | 'sceneContext'
  | 'dataLayer'
  | 'operations'
  | 'gizmos'
  | 'editorCamera'
  | 'preferences'
  | 'enumEntity'
> {
  const events = mitt<SdkContextEvents>();
  const { engine, components } = createEngineContext({
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
