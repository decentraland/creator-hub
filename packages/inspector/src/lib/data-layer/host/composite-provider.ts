import type { Scene } from '@dcl/schemas';
import type { CompositeDefinition, Entity, IEngine } from '@dcl/ecs';
import { Composite, CrdtMessageType, EntityMappingMode } from '@dcl/ecs';
import { initComponents, migrateAll as migrateAllAssetPacksComponents } from '@dcl/asset-packs';
import type { EditorComponents } from '../../sdk/components';
import { EditorComponentNames } from '../../sdk/components';
import { migrateAll as migrateAllInspectorComponents } from '../../sdk/components/versioning/registry';
import type { FileSystemInterface } from '../types';
import { getMinimalComposite } from '../client/feeded-local-fs';
import type { InspectorPreferences } from '../../logic/preferences/types';
import { buildNodesHierarchyIfNotExists } from './utils/migrations/build-nodes-hierarchy';
import { removeLegacyEntityNodeComponents } from './utils/migrations/legacy-entity-node';
import { DIRECTORY, withAssetDir } from './fs-utils';
import { dumpEngineToComposite, generateEntityNamesType } from './utils/engine-to-composite';
import type { CompositeManager } from './utils/fs-composite-provider';
import { createFsCompositeProvider } from './utils/fs-composite-provider';
import { toSceneComponent } from './utils/component';
import { addNodesComponentsToPlayerAndCamera } from './utils/migrations/add-nodes-to-player-and-camera';
import { fixNetworkEntityValues } from './utils/migrations/fix-network-entity-values';
import { selectSceneEntity } from './utils/migrations/select-scene-entity';
import {
  type StateProvider,
  type Operation,
  type Transaction,
  OperationType,
} from './state-manager';
import { createTagsComponent } from './utils/migrations/create-tags-components';
import { repairScriptParams } from './utils/migrations/repair-script-params';

enum DirtyState {
  Clean = 'clean',
  Dirty = 'dirty',
  DirtyAndNeedsDump = 'dirty_needs_dump',
}

export const ENTITY_NAMES_PATH = 'entity-names.ts';

export class CompositeProvider implements StateProvider {
  readonly name = 'composite';

  private composite: CompositeDefinition | null = null;
  private dirtyState = DirtyState.Clean;
  private readonly fs: FileSystemInterface;
  private readonly engine: IEngine;
  private readonly getInspectorPreferences: () => InspectorPreferences;
  private readonly compositePath: string;
  private compositeManager: CompositeManager | null = null;
  private pendingOperations = new Set<string>();
  private savePromise: Promise<void> | null = null;
  private lastSaveTime = 0;
  private readonly minSaveInterval = 100;
  private trailingSaveTimeout: ReturnType<typeof setTimeout> | null = null;
  // Bumped by every edit. A save only marks the provider clean when no edit arrived between
  // its engine dump and the end of its write: the trailing save does not hold the
  // transaction queue, so an edit can land mid-write, and calling it clean then would leave
  // that edit in memory with nothing left to save it.
  private editGeneration = 0;

  constructor(
    fs: FileSystemInterface,
    engine: IEngine,
    getInspectorPreferences: () => InspectorPreferences,
    compositePath: string,
  ) {
    this.fs = fs;
    this.engine = engine;
    this.getInspectorPreferences = getInspectorPreferences;
    this.compositePath = compositePath;
  }

  static async create(
    fs: FileSystemInterface,
    engine: IEngine,
    getInspectorPreferences: () => InspectorPreferences,
    compositePath: string,
  ): Promise<CompositeProvider> {
    const provider = new CompositeProvider(fs, engine, getInspectorPreferences, compositePath);
    await provider.initialize();
    return provider;
  }

  private async initialize(): Promise<void> {
    await this.ensureCompositeExists();
    this.compositeManager = await this.createCompositeManager();
    await this.loadComposite();
    this.runMigrations();
    await this.initializeComponents();
    // No edit follows a load-time repair, so save it here (or leave it dirty for the next flush).
    if (await repairScriptParams(this.engine, this.fs)) {
      this.dirtyState = DirtyState.DirtyAndNeedsDump;
      if (this.getInspectorPreferences().autosaveEnabled) await this.saveComposite(true);
    }
    await this.overrideWithSceneJson();
  }

  private async ensureCompositeExists(): Promise<void> {
    if (!(await this.fs.existFile(this.compositePath))) {
      console.log('Main composite does not exist, creating minimal composite');
      const minimal = getMinimalComposite();
      const buffer = Buffer.from(JSON.stringify(minimal, null, 2), 'utf-8');
      await this.fs.writeFile(this.compositePath, buffer);
    } else {
      console.log('Main composite exists');
    }
  }

  private async createCompositeManager(): Promise<CompositeManager> {
    return createFsCompositeProvider(this.fs);
  }

  private async loadComposite(): Promise<void> {
    if (!this.compositeManager) throw new Error('Composite manager not initialized');

    const loadedCompositeResource = this.compositeManager.getCompositeOrNull(this.compositePath);
    if (!loadedCompositeResource) throw new Error('Invalid composite');

    console.log('Loading composite into engine...');

    Composite.instance(this.engine, loadedCompositeResource, this.compositeManager, {
      entityMapping: {
        type: EntityMappingMode.EMM_DIRECT_MAPPING,
        getCompositeEntity: (entity: number | Entity) => entity as Entity,
      },
    });

    this.composite = loadedCompositeResource.composite;
  }

  private runMigrations(): void {
    removeLegacyEntityNodeComponents(this.engine);
    buildNodesHierarchyIfNotExists(this.engine);
    addNodesComponentsToPlayerAndCamera(this.engine);
    fixNetworkEntityValues(this.engine);
    selectSceneEntity(this.engine);
    migrateAllAssetPacksComponents(this.engine);
    migrateAllInspectorComponents(this.engine);
    createTagsComponent(this.engine);
  }

  private async initializeComponents(): Promise<void> {
    initComponents(this.engine);
  }

  private bufferToScene(buffer: Buffer): Scene {
    return JSON.parse(new TextDecoder().decode(buffer));
  }

  private async overrideWithSceneJson(): Promise<void> {
    const SceneMetadata = this.engine.getComponent(
      EditorComponentNames.Scene,
    ) as EditorComponents['Scene'];

    if (await this.fs.existFile('scene.json')) {
      console.log('Overriding SceneMetadata with scene.json');
      const sceneJsonBuffer = await this.fs.readFile('scene.json');
      const sceneJson = this.bufferToScene(sceneJsonBuffer);
      SceneMetadata.createOrReplace(this.engine.RootEntity, toSceneComponent(sceneJson));
    }
  }

  canHandle(operation: Operation): boolean {
    if (
      operation.type === OperationType.SCENE_UPDATE &&
      operation.componentName === EditorComponentNames.Scene
    ) {
      return true;
    }

    if (operation.type === OperationType.COMPOSITE_UPDATE) {
      if (
        !operation.componentName ||
        operation.componentName === EditorComponentNames.Scene ||
        operation.componentName === EditorComponentNames.Selection
      ) {
        return false;
      }

      return (
        operation.operation === CrdtMessageType.PUT_COMPONENT ||
        operation.operation === CrdtMessageType.DELETE_COMPONENT
      );
    }

    return false;
  }

  async processOperation(operation: Operation, transaction: Transaction): Promise<void> {
    if (!this.canHandle(operation)) return;

    this.pendingOperations.add(transaction.id);
    this.editGeneration++;

    if (this.dirtyState === DirtyState.Clean) {
      this.dirtyState = DirtyState.DirtyAndNeedsDump;
    }
  }

  async onTransactionComplete(transaction: Transaction): Promise<void> {
    if (!this.pendingOperations.has(transaction.id)) return;

    this.pendingOperations.delete(transaction.id);

    if (this.dirtyState === DirtyState.DirtyAndNeedsDump) {
      const preferences = this.getInspectorPreferences();
      const shouldAutosave = preferences.autosaveEnabled;
      if (!shouldAutosave) return;

      const now = Date.now();
      if (now - this.lastSaveTime >= this.minSaveInterval) {
        this.lastSaveTime = now;
        await this.saveComposite(true);
      } else {
        // Throttled. Without a trailing save the final edit of a rapid burst stays dirty
        // until some later transaction happens to arrive — and if none does, it never
        // reaches disk at all.
        this.scheduleTrailingSave(this.minSaveInterval - (now - this.lastSaveTime));
      }
    }
  }

  private scheduleTrailingSave(delay: number): void {
    if (this.trailingSaveTimeout) return;

    this.trailingSaveTimeout = setTimeout(() => {
      this.trailingSaveTimeout = null;
      if (this.dirtyState !== DirtyState.DirtyAndNeedsDump) return;
      if (!this.getInspectorPreferences().autosaveEnabled) return;

      this.lastSaveTime = Date.now();
      // Fire-and-forget by necessity (no caller to await a timer), but the rejection is
      // handled here so it cannot go unobserved; the dirty state survives for the flush
      // that runs before publishing.
      this.saveComposite(true).catch(error =>
        console.error('Failed saving composite (trailing save):', error),
      );
    }, delay);
  }

  async saveComposite(dump = true): Promise<CompositeDefinition | null> {
    // Chained rather than awaited-then-started: two callers waiting on the same promise would
    // otherwise both wake up and write concurrently. A previous save's failure is never
    // rethrown here — each caller only owns its own attempt.
    const previous = this.savePromise ?? Promise.resolve();
    const save = previous.catch(() => {}).then(() => this.performSave(dump).then(() => {}));
    this.savePromise = save;
    try {
      await save;
    } finally {
      // Without the `finally` a rejected save leaves `savePromise` set forever, and every
      // later call rethrows that same stale error while never writing anything.
      if (this.savePromise === save) this.savePromise = null;
    }

    return this.composite;
  }

  private async performSave(dump: boolean): Promise<CompositeDefinition | null> {
    const generation = this.editGeneration;
    this.composite = dumpEngineToComposite(this.engine, 'json');

    if (!dump) {
      this.markCleanIfUnchangedSince(generation);
      return this.composite;
    }

    if (!this.compositeManager) {
      throw new Error('Composite manager not initialized');
    }

    await this.compositeManager.save(
      { src: this.compositePath, composite: this.composite! },
      'json',
    );

    await generateEntityNamesType(
      this.engine,
      withAssetDir(DIRECTORY.SCENE + '/' + ENTITY_NAMES_PATH),
      'EntityNames',
      this.fs,
    );

    this.markCleanIfUnchangedSince(generation);
    return this.composite;
  }

  private markCleanIfUnchangedSince(generation: number): void {
    if (this.editGeneration === generation) this.dirtyState = DirtyState.Clean;
  }

  getComposite(): CompositeDefinition | null {
    return this.composite;
  }

  isDirty(): boolean {
    return this.dirtyState !== DirtyState.Clean;
  }

  getDirtyState(): DirtyState {
    return this.dirtyState;
  }

  async forceReload(): Promise<void> {
    await this.initialize();
  }

  async dispose(): Promise<void> {
    if (this.trailingSaveTimeout) {
      clearTimeout(this.trailingSaveTimeout);
      this.trailingSaveTimeout = null;
    }

    if (this.savePromise) {
      await this.savePromise.catch(() => {});
    }

    this.pendingOperations.clear();
    this.dirtyState = DirtyState.Clean;
    this.composite = null;
    this.compositeManager = null;
  }
}
