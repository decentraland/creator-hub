import type { IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { EditorComponentsTypes, Node } from '../../../../sdk/components';
import { EditorComponentNames } from '../../../../sdk/components';

export function addNodesComponentsToPlayerAndCamera(engine: IEngine) {
  function addNodes() {
    engine.removeSystem(addNodes);
    const Nodes = engine.getComponentOrNull(
      EditorComponentNames.Nodes,
    ) as LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Nodes']>;
    if (!Nodes) return;

    const nodes = Nodes.getOrNull(engine.RootEntity)?.value || [];
    const newNodes: Node[] = nodes.map(node => ({ ...node, children: [...node.children] }));
    let shouldUpdate = false;

    if (!newNodes.some(node => node.entity === engine.PlayerEntity)) {
      newNodes.push({ entity: engine.PlayerEntity, children: [] });
      shouldUpdate = true;
    }
    if (!newNodes.some(node => node.entity === engine.CameraEntity)) {
      newNodes.push({ entity: engine.CameraEntity, children: [] });
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      Nodes.createOrReplace(engine.RootEntity, { value: newNodes });
    }
  }

  engine.addSystem(addNodes);
}
