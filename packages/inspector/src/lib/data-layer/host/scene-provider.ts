import { merge } from 'ts-deepmerge';
import { CrdtMessageType } from '@dcl/ecs';
import type { IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { Scene } from '@dcl/schemas';
import type { FileSystemInterface } from '../types';
import type { EditorComponentsTypes } from '../../sdk/components';
import { EditorComponentNames } from '../../sdk/components';
import { fromSceneComponent, getValidParcels } from './utils/component';
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
  /**
   * Serializes writes. Never rejects: a failed write is recorded on `saveError` and leaves
   * `dirty` set, so a rejection can never end up unobserved — an unobserved one is a failed
   * save that reaches nobody.
   */
  private saveQueue: Promise<void> = Promise.resolve();
  /** The in-memory scene has edits that are not on disk yet — or whose write failed. */
  private dirty = false;
  private saveError: Error | null = null;

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
    // a scene must always have at least one valid parcel: fall back to the base parcel,
    // and only to 0,0 when there is no other known set of coordinates
    const { parcels, base } = getValidParcels(scene.scene?.parcels, scene.scene?.base);
    return {
      ...scene,
      display: {
        ...scene.display,
        title: scene.display?.title || '',
      },
      scene: {
        ...scene.scene,
        base,
        parcels,
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
      this.dirty = true;
      this.pendingSceneUpdates.delete(transaction.id);
    } catch (error) {
      console.error('Failed to complete scene transaction:', error);
      this.pendingSceneUpdates.delete(transaction.id);
      return;
    }

    // Awaited on purpose: an unawaited write means a failure has nobody to reject to, and
    // the transaction reports success while scene.json still holds the previous content.
    await this.enqueueSave();
    if (this.saveError) throw this.saveError;
  }

  /**
   * Queues a write of the current in-memory scene. Resolves once that write has been
   * attempted; check `saveError` for the outcome.
   */
  private enqueueSave(): Promise<void> {
    this.saveQueue = this.saveQueue.then(() => this.writeScene());
    return this.saveQueue;
  }

  private async writeScene(): Promise<void> {
    if (!this.dirty) return;

    const snapshot = this.scene;
    try {
      const buffer = Buffer.from(JSON.stringify(snapshot, null, 2), 'utf-8');
      await this.fs.writeFile('scene.json', buffer);
      // An edit that landed while the write was in flight is not on disk yet, so it keeps
      // the provider dirty and the next flush writes it.
      if (this.scene === snapshot) this.dirty = false;
      this.saveError = null;
    } catch (error) {
      this.saveError = error instanceof Error ? error : new Error(String(error));
      console.error('Failed to save scene.json:', error);
    }
  }

  async syncFromEngine(engine: IEngine): Promise<void> {
    try {
      const SceneComponent = engine.getComponent(
        EditorComponentNames.Scene,
      ) as LastWriteWinElementSetComponentDefinition<EditorComponentsTypes['Scene']>;
      const sceneValue = SceneComponent.getOrNull(engine.RootEntity);
      if (!sceneValue) return;

      const partialScene = fromSceneComponent(sceneValue);
      const merged = merge.withOptions({ mergeArrays: false }, this.scene, partialScene) as Scene;

      this.scene = SceneProvider.augmentDefaults(merged);
      this.dirty = true;
    } catch (error) {
      console.error('Failed to sync scene from engine:', error);
      return;
    }

    await this.enqueueSave();
  }

  /**
   * Waits for every queued write and guarantees the in-memory scene reached disk, retrying
   * once when the last attempt failed or was superseded. Rejects when it still cannot be
   * written, so callers that must not proceed on stale content — publishing, above all —
   * can stop instead of shipping the previous scene.json.
   */
  async flush(): Promise<void> {
    await this.saveQueue;
    if (this.dirty) await this.enqueueSave();
    // Still dirty after a fresh attempt means that attempt failed — a write that only got
    // superseded by a newer edit leaves `dirty` set but clears the error.
    if (this.dirty && this.saveError) throw this.saveError;
  }

  getScene(): SceneWithDefaults {
    return { ...this.scene };
  }

  async forceReload(): Promise<void> {
    await this.saveQueue;
    this.scene = await SceneProvider.loadScene(this.fs);
    this.pendingSceneUpdates.clear();
    this.dirty = false;
    this.saveError = null;
  }

  async dispose(): Promise<void> {
    await this.saveQueue;
    this.pendingSceneUpdates.clear();
  }
}
