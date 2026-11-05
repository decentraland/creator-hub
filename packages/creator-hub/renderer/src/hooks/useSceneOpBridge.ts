import { type MutableRefObject, useEffect } from 'react';

import type { initRpc } from '/@/modules/rpc';

import { ai } from '#preload';

type Rpc = ReturnType<typeof initRpc>;
type SceneClient = Rpc['scene'];

// Routes a scene-mutation op (from main's MCP server) to the inspector SceneRpc client. One
// entry per SceneRpc method; add a line here + the matching client method + MCP tool.
export const SCENE_OP_HANDLERS: Record<
  string,
  (scene: SceneClient, params: Record<string, unknown>) => Promise<unknown>
> = {
  create_entity: (scene, p) =>
    scene.createEntity(p.name as string | undefined, p.parent as number | undefined),
  remove_entity: (scene, p) => scene.removeEntity(p.entity as number),
  set_parent: (scene, p) => scene.setParent(p.entity as number, p.parent as number),
  set_component: (scene, p) =>
    scene.setComponent(
      p.entity as number,
      p.component as string,
      p.value as Record<string, unknown>,
    ),
  remove_component: (scene, p) => scene.removeComponent(p.entity as number, p.component as string),
  attach_script: (scene, p) =>
    scene.attachScript(p.entity as number, p.path as string, p.priority as number | undefined),
  search_catalog: (scene, p) =>
    scene.searchCatalog(p.query as string | undefined, p.limit as number | undefined),
  place_smart_item: (scene, p) =>
    scene.placeSmartItem(
      p.assetId as string,
      p.name as string | undefined,
      p.position as { x: number; y: number; z: number } | undefined,
    ),
  undo: scene => scene.undo(),
  get_scene_metrics: scene => scene.getSceneMetrics(),
  get_selection: scene => scene.getSelection(),
  get_scene_settings: scene => scene.getSceneSettings(),
  set_scene_settings: (scene, p) => scene.setSceneSettings(p),
};

/**
 * Answers main's scene ops while the editor is open: runs each on the live inspector and
 * replies with the result. Always listening, whatever the AI assistant setting: agents
 * outside the Hub send ops too, and gating this on the assistant left their writes
 * unanswered until main timed them out (#1718 QA). Main serializes the ops.
 */
export function useSceneOpBridge(rpcRef: MutableRefObject<Rpc | undefined>) {
  useEffect(() => {
    const { cleanup } = ai.onSceneOpRequest(async req => {
      const rpc = rpcRef.current;
      const handler = SCENE_OP_HANDLERS[req.op];
      if (!rpc) return ai.sceneOpResult(req.id, false, 'No scene is open.');
      if (!handler) return ai.sceneOpResult(req.id, false, `Unknown scene op "${req.op}".`);
      try {
        const value = await handler(rpc.scene, req.params);
        ai.sceneOpResult(req.id, true, value);
      } catch (e) {
        ai.sceneOpResult(req.id, false, e instanceof Error ? e.message : String(e));
      }
    });
    return cleanup;
  }, [rpcRef]);
}
