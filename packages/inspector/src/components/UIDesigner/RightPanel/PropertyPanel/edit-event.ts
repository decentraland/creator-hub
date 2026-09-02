import type { Event, Events } from '../../../../lib/logic/analytics';
import type { InteractionStateKey } from '../../code/interaction-convention';

export function editUiPropertyEvent(
  componentId: string,
  patch: Record<string, unknown>,
  interactionLayer?: InteractionStateKey,
): Events[Event.EDIT_UI_PROPERTY] {
  const property = `${componentId}:${Object.keys(patch)[0] ?? ''}`;
  return interactionLayer ? { property, interactionLayer } : { property };
}
