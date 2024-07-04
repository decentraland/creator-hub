import {reducer as translationReducer} from './translation';
import {reducer as workspaceReducer} from './workspace';

export function createRootReducer() {
  return {
    translation: translationReducer,
    workspace: workspaceReducer,
  };
}
