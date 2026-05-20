import type { Scene } from '@dcl/schemas';
import type { CompositeDefinition, Entity, IEngine } from '@dcl/ecs';
import { Composite, CrdtMessageType, EntityMappingMode } from '@dcl/ecs';
import {
  COMPONENTS_WITH_ID,
  initComponents,
  migrateAll as migrateAllAssetPacksComponents,
} from '@dcl/asset-packs';
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

    let loadedCompositeResource = this.compositeManager.getCompositeOrNull(this.compositePath);
    if (!loadedCompositeResource) {
      // Alt composite files (e.g. composite.json under assets/custom or assets/asset-packs)
      // are not picked up by the default `.composite`-only scan. Read and parse them directly,
      // resolving smart-item placeholders ({self}, {self:Component}, {N:Component}) so the
      // engine receives only numeric ids.
      try {
        const buffer = await this.fs.readFile(this.compositePath);
        const json = JSON.parse(new TextDecoder().decode(buffer));
        const resolved = resolveCompositePlaceholders(json);
        loadedCompositeResource = {
          src: this.compositePath,
          composite: Composite.fromJson(resolved),
        };
      } catch (err) {
        throw new Error(`Invalid composite at ${this.compositePath}: ${(err as Error).message}`);
      }
    }

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

const SELF_REF = /^\{self:(.+)\}$/;
const CROSS_REF = /^\{(\d+):(.+)\}$/;
const COUNTER_COMPONENT = 'asset-packs::Counter';

function resolveCompositePlaceholders(json: any): any {
  if (!json || !Array.isArray(json.components)) return json;
  const clone = JSON.parse(JSON.stringify(json));
  const idMap = new Map<string, number>();

  // Initialize id counter from existing Counter.value on the root entity (0), if present.
  // We mirror getNextId's contract (Counter.getOrCreateMutable(RootEntity); ++counter.value)
  // but locally so we don't mutate the engine before Composite.instance runs.
  let counter = 0;
  const counterComponent = clone.components.find((c: any) => c.name === COUNTER_COMPONENT);
  const rootCounterValue = Number(counterComponent?.data?.['0']?.json?.value);
  if (Number.isFinite(rootCounterValue)) counter = rootCounterValue;

  for (const component of clone.components) {
    if (!COMPONENTS_WITH_ID.includes(component.name) || !component.data) continue;
    for (const [entityId, dataEntry] of Object.entries<any>(component.data)) {
      const value = dataEntry?.json;
      if (value && value.id === '{self}') {
        const newId = ++counter;
        idMap.set(`${component.name}:${entityId}`, newId);
        value.id = newId;
      }
    }
  }

  // Persist the final counter back on entity 0 so the engine's Counter.value
  // continues allocating from the right spot after Composite.instance loads.
  if (counterComponent) {
    counterComponent.data = counterComponent.data ?? {};
    const rootEntry = counterComponent.data['0'] ?? { json: { id: 0, value: 0 } };
    rootEntry.json = rootEntry.json ?? {};
    rootEntry.json.value = counter;
    if (rootEntry.json.id === undefined) rootEntry.json.id = 0;
    counterComponent.data['0'] = rootEntry;
  }

  const resolve = (val: any, entityId: string): any => {
    if (val === null || val === undefined) return val;
    if (typeof val === 'string') {
      if (val === '{self}') return Number(entityId);
      const self = val.match(SELF_REF);
      if (self) {
        const mapped = idMap.get(`${self[1]}:${entityId}`);
        return mapped ?? val;
      }
      const cross = val.match(CROSS_REF);
      if (cross) {
        const mapped = idMap.get(`${cross[2]}:${cross[1]}`);
        return mapped ?? val;
      }
      return val;
    }
    if (Array.isArray(val)) return val.map(v => resolve(v, entityId));
    if (typeof val === 'object') {
      const out: any = {};
      for (const [k, v] of Object.entries(val)) out[k] = resolve(v, entityId);
      return out;
    }
    return val;
  };

  for (const component of clone.components) {
    if (!component.data) continue;
    for (const [entityId, dataEntry] of Object.entries<any>(component.data)) {
      if (dataEntry?.json) {
        dataEntry.json = resolve(dataEntry.json, entityId);
      }
    }
  }

  return clone;
}
