import type { Scene } from '@dcl/schemas';
import type { CompositeDefinition, Entity, IEngine } from '@dcl/ecs';
import { Composite, CrdtMessageType, EntityMappingMode } from '@dcl/ecs';
import { initComponents, migrateAllAssetPacksComponents } from '@dcl/asset-packs';
import type { EditorComponents } from '../../sdk/components';
import { EditorComponentNames } from '../../sdk/components';
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
import { migrateSceneMetadata } from './utils/migrations/migrate-scene-metadata';
import { migrateInspectorComponents } from './utils/migrations/migrate-inspector-components';
import {
  type StateProvider,
  type Operation,
  type Transaction,
  OperationType,
} from './state-manager';
import { createTagsComponent } from './utils/migrations/create-tags-components';

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
    migrateSceneMetadata(this.engine);
    migrateAllAssetPacksComponents(this.engine);
    migrateInspectorComponents(this.engine);
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
      const now = Date.now();

      if (shouldAutosave && now - this.lastSaveTime >= this.minSaveInterval) {
        this.lastSaveTime = now;
        await this.saveComposite(true);
      }
    }
  }

  async saveComposite(dump = true): Promise<CompositeDefinition | null> {
    if (this.savePromise) {
      await this.savePromise;
    }

    this.savePromise = this.performSave(dump).then(() => {});
    await this.savePromise;
    this.savePromise = null;

    return this.composite;
  }

  private async performSave(dump: boolean): Promise<CompositeDefinition | null> {
    try {
      this.composite = dumpEngineToComposite(this.engine, 'json');

      if (!dump) {
        this.dirtyState = DirtyState.Clean;
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

      this.dirtyState = DirtyState.Clean;
      return this.composite;
    } catch (error) {
      console.error('Failed saving composite:', error);
      return null;
    }
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
    if (this.savePromise) {
      await this.savePromise;
    }

    this.pendingOperations.clear();
    this.dirtyState = DirtyState.Clean;
    this.composite = null;
    this.compositeManager = null;
  }
}
