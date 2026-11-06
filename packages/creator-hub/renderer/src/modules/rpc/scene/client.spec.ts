import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryTransport, RPC } from '@dcl/mini-rpc';

import { SceneRpcClient, SceneRpcTimeoutError, SceneRpcUnsupportedError } from './client';

describe('SceneRpcClient errors', () => {
  let client: SceneRpcClient;
  let inspector: RPC<string, any, any>;

  beforeEach(() => {
    const host = new InMemoryTransport();
    const iframe = new InMemoryTransport();
    host.connect(iframe);
    iframe.connect(host);
    client = new SceneRpcClient(host);
    inspector = new RPC('SceneRpcInbound', iframe);
  });

  describe('when the inspector has no handler for the method', () => {
    it('should reject with SceneRpcUnsupportedError naming it', async () => {
      const error = await client.saveScene().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SceneRpcUnsupportedError);
      expect((error as SceneRpcUnsupportedError).method).toBe('save_scene');
    });
  });

  describe('when the inspector answers with its own error', () => {
    beforeEach(() => {
      inspector.handle('save_scene', async () => {
        throw new Error('EBUSY: resource busy or locked');
      });
    });

    it('should pass that error through untyped', async () => {
      const error = await client.saveScene().catch((e: unknown) => e);

      expect(error).not.toBeInstanceOf(SceneRpcUnsupportedError);
      expect(error).not.toBeInstanceOf(SceneRpcTimeoutError);
      expect((error as Error).message).toBe('EBUSY: resource busy or locked');
    });
  });

  describe('when the inspector never answers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      inspector.handle('get_scene_settings', () => new Promise(() => undefined));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should reject with SceneRpcTimeoutError after the request timeout', async () => {
      const settled = client.getSceneSettings().catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(5000);

      const error = await settled;
      expect(error).toBeInstanceOf(SceneRpcTimeoutError);
      expect((error as SceneRpcTimeoutError).method).toBe('get_scene_settings');
    });
  });
});
