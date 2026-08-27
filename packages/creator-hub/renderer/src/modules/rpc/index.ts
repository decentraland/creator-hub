import { type Project } from '/shared/types/projects';
import { hasCustomCode } from '/shared/scene-parser';

import { fs, custom, workspace, ai } from '#preload';

import { SceneRpcClient } from './scene/client';
import { SceneRpcServer } from './scene/server';
import { type Method, type Params, type Result, StorageRPC } from './storage';
import { AuthenticatedMessageTransport } from './transport';

export type RPCInfo = {
  iframe: HTMLIFrameElement;
  project: Project;
  scene: SceneRpcClient;
};

export interface Callbacks {
  writeFile?: (
    rpcInfo: RPCInfo,
    fnParams: Params[Method.WRITE_FILE],
  ) => Promise<Result[Method.WRITE_FILE]>;
}

/**
 * Resolves an Inspector-supplied path against one of the two roots the iframe may address:
 * the open project, or the shared custom-assets directory.
 *
 * Every path-taking storage and scene RPC handler routes through here, so this is the single
 * place the two roots are enforced. Rejects rather than clamping, which the Inspector already
 * handles — a refused path surfaces there as an ordinary failed filesystem call.
 */
export const getPath = async (filePath: string, project: Project) => {
  const normalizedPath = filePath.replace(/\\/g, '/');

  if (normalizedPath === 'custom' || normalizedPath.startsWith('custom/')) {
    const customPath = normalizedPath === 'custom' ? '' : normalizedPath.slice('custom/'.length);
    return fs.resolveWithin(await custom.getPath(), customPath);
  }

  return fs.resolveWithin(project.path, normalizedPath);
};

export function initRpc(iframe: HTMLIFrameElement, project: Project, cbs: Partial<Callbacks> = {}) {
  const transport = new AuthenticatedMessageTransport(iframe);
  const sceneClient = new SceneRpcClient(transport);
  const sceneServer = new SceneRpcServer(transport, project);
  const params = { iframe, project, scene: sceneClient };
  const storage = new StorageRPC(transport, cbs, params);

  void Promise.all([
    sceneClient.selectAssetsTab('AssetsPack'),
    sceneClient.selectSceneInspectorTab('details'),
  ]).catch(console.error);

  void (async () => {
    try {
      const content = await workspace.getSceneSourceFile(project.path);
      const hasCustom = hasCustomCode(content);
      await sceneClient.setSceneCustomCode(hasCustom);
    } catch (error) {
      console.error('Failed to detect custom code:', error);
    }
  })();

  return {
    ...params,
    dispose: () => {
      storage.dispose();
      sceneServer.dispose();
      sceneClient.dispose();
      // The iframe is recreated on every scene open, so a transport left listening on
      // `window` outlives the frame it was bound to and accumulates one per load.
      transport.dispose();
    },
  };
}

export async function takeScreenshot(iframe: HTMLIFrameElement, sceneRPC?: SceneRpcClient) {
  // TODO:
  // 1. make the camera position/target relative to parcels rows & columns
  // 2. the SceneServer only allows to reposition the main camera, so repositioning it, will also
  //    reposition the content creator's view. We need a way to specify a different camera or a way to
  //    save the current position, move it for a screenshot, and restore it
  //
  // leaving the next line just for reference:
  // await Promise.all([camera.setPosition(x, y, z), camera.setTarget(x, y, z)]);
  if (sceneRPC) {
    // SceneRpcClient.request is timeout-bounded, so this rejects rather than hanging when no
    // renderer answers. Under Bevy the scene-RPC capture yields nothing (wgpu canvas), so
    // fall back to a compositor capture of the viewport (#1526) — used for AI screenshots
    // AND scene thumbnails, so Bevy scenes get a thumbnail too.
    const shot = await sceneRPC.takeScreenshot(+iframe.width, +iframe.height).catch(() => null);
    return shot ?? (await captureViewportFallback(iframe, sceneRPC)) ?? undefined;
  }

  // Owned here, so it has to be closed here: every thumbnail regenerated without a caller
  // supplied client would otherwise leave another `message` listener on `window`.
  const transport = new AuthenticatedMessageTransport(iframe);
  const client = new SceneRpcClient(transport);
  try {
    const shot = await client.takeScreenshot(+iframe.width, +iframe.height).catch(() => null);
    return shot ?? (await captureViewportFallback(iframe, client)) ?? undefined;
  } finally {
    client.dispose();
    transport.dispose();
  }
}

// Bevy screenshot/thumbnail fallback (#1526): the wgpu canvas can't be read via
// canvas.toDataURL and the engine's `/screenshot` command may be unavailable, so the
// scene-RPC capture returns nothing. Capture the viewport region off Electron's compositor
// instead — the inspector reports where the viewport sits inside its (cross-origin) iframe,
// we offset by the iframe's position in this window, and main runs webContents.capturePage
// on that rect (it sees the wgpu canvas, unlike a DOM readback). Returns null if the
// viewport rect is unavailable or the capture fails; callers treat that as "no image".
export async function captureViewportFallback(
  iframe: HTMLIFrameElement,
  sceneRPC: SceneRpcClient,
): Promise<string | null> {
  try {
    const { rect } = await sceneRPC.getViewportRect();
    if (rect === null) return null;
    const host = iframe.getBoundingClientRect();
    return await ai.captureViewport({
      x: host.x + rect.x,
      y: host.y + rect.y,
      width: rect.width,
      height: rect.height,
    });
  } catch {
    return null;
  }
}
