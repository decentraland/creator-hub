import { FreeCamera, NullEngine, Scene, Vector3, ScreenshotTools } from '@babylonjs/core';
import { InMemoryTransport } from '@dcl/mini-rpc';
import { SceneClient } from '../scene/client';
import { SceneServer } from '../scene/server';

// TODO: check this tests after RPC refactor
describe('SceneRPC', () => {
  const parent = new InMemoryTransport();
  const iframe = new InMemoryTransport();

  parent.connect(iframe);
  iframe.connect(parent);

  const engine = new NullEngine();
  const scene = new Scene(engine);
  const camera = new FreeCamera('camera', new Vector3(0, 0, 0), scene);

  const client = new SceneClient(parent);
  const _server = new SceneServer(iframe, engine, camera);

  describe('When using the takeScreenshot method of the client', () => {
    it('should generate a screenshot on the server and relay it back to the client', async () => {
      const image =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==';
      const spy = vi.spyOn(ScreenshotTools, 'CreateScreenshotAsync');
      spy.mockResolvedValue(image);
      await expect(client.takeScreenshot(1024, 1024)).resolves.toBe(image);
      expect(spy).toHaveBeenCalledWith(
        engine,
        camera,
        expect.objectContaining({ width: 1024, height: 1024 }),
      );
      spy.mockRestore();
    });
  });
  describe('When using the setPosition method of the client', () => {
    it('should set the position of the scene in the server', async () => {
      const spy = vi.spyOn(camera.position, 'set');
      await expect(client.setPosition(8, 0, 8)).resolves.toBe(undefined);
      expect(spy).toHaveBeenCalledWith(8, 0, 8);
      spy.mockRestore();
    });
  });
  describe('When using the setTarget method of the client', () => {
    it('should set the target of the scene in the server', async () => {
      const spy = vi.spyOn(camera, 'setTarget');
      await expect(client.setTarget(8, 0, 8)).resolves.toBe(undefined);
      expect(spy).toHaveBeenCalledWith(new Vector3(8, 0, 8));
      spy.mockRestore();
    });
  });
});
