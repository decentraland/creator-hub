import { merge } from 'ts-deepmerge';
import { CrdtMessageType } from '@dcl/ecs';
import type { Scene } from '@dcl/schemas';
import type { FileSystemInterface } from '../types';
import type { EditorComponentsTypes } from '../../sdk/components';
import { EditorComponentNames } from '../../sdk/components';
import { fromSceneComponent } from './utils/component';
import {
  type StateProvider,
  type Operation,
  type Transaction,
  OperationType,
} from './state-manager';

type SceneWithDefaults = Scene & {
  display: {
    title: string;
  };
};

export class SceneProvider implements StateProvider {
  readonly name = 'scene';
  private scene: SceneWithDefaults;
  private readonly fs: FileSystemInterface;
  private pendingSceneUpdates = new Map<string, Partial<Scene>>();
  private savePromise: Promise<void> | null = null;

  constructor(fs: FileSystemInterface, initialScene: SceneWithDefaults) {
    this.fs = fs;
    this.scene = initialScene;
  }

  static async create(fs: FileSystemInterface): Promise<SceneProvider> {
    const scene = await SceneProvider.loadScene(fs);
    return new SceneProvider(fs, scene);
  }

  private static async loadScene(fs: FileSystemInterface): Promise<SceneWithDefaults> {
    let scene: Scene = {} as Scene;
    try {
      const buffer = await fs.readFile('scene.json');
      scene = JSON.parse(new TextDecoder().decode(buffer));
    } catch (e) {
      console.error('Reading scene.json file failed: ', e);
    }

    return SceneProvider.augmentDefaults(scene);
  }

  private static augmentDefaults(scene: Scene): SceneWithDefaults {
    return {
      ...scene,
      display: {
        ...scene.display,
        title: scene.display?.title || '',
      },
    };
  }

  canHandle(operation: Operation): boolean {
    return (
      operation.type === OperationType.SCENE_UPDATE &&
      operation.operation === CrdtMessageType.PUT_COMPONENT &&
      operation.componentName === EditorComponentNames.Scene
    );
  }

  async processOperation(operation: Operation, transaction: Transaction): Promise<void> {
    if (!this.canHandle(operation)) return;

    try {
      const partialScene = fromSceneComponent(
        operation.componentValue as EditorComponentsTypes['Scene'],
      );

      this.pendingSceneUpdates.set(transaction.id, partialScene);
    } catch (error) {
      console.error('Failed to process scene operation:', error);
    }
  }

  async onTransactionComplete(transaction: Transaction): Promise<void> {
    const pendingUpdate = this.pendingSceneUpdates.get(transaction.id);
    if (!pendingUpdate) return;

    try {
      const merged = merge.withOptions({ mergeArrays: false }, this.scene, pendingUpdate) as Scene;

      this.scene = SceneProvider.augmentDefaults(merged);
      this.pendingSceneUpdates.delete(transaction.id);

      if (this.savePromise) {
        await this.savePromise;
      }

      this.savePromise = this.saveScene();
    } catch (error) {
      console.error('Failed to complete scene transaction:', error);
      this.pendingSceneUpdates.delete(transaction.id);
    }
  }

  private async saveScene(): Promise<void> {
    try {
      const buffer = Buffer.from(JSON.stringify(this.scene, null, 2), 'utf-8');
      await this.fs.writeFile('scene.json', buffer);
    } catch (error) {
      console.error('Failed to save scene.json:', error);
      throw error;
    } finally {
      this.savePromise = null;
    }
  }

  getScene(): SceneWithDefaults {
    return { ...this.scene };
  }

  async forceReload(): Promise<void> {
    this.scene = await SceneProvider.loadScene(this.fs);
    this.pendingSceneUpdates.clear();

    if (this.savePromise) {
      await this.savePromise;
    }
  }

  async dispose(): Promise<void> {
    if (this.savePromise) {
      await this.savePromise;
    }
    this.pendingSceneUpdates.clear();
  }
}
