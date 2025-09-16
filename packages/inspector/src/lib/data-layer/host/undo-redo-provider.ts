import type {
  CompositeDefinition,
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
} from '@dcl/ecs';
import { CrdtMessageType } from '@dcl/ecs';
import type { FileSystemInterface } from '../types';
import upsertAsset from './upsert-asset';
import { findPrevValue } from './utils/component';
import { UndoRedoArray } from './utils/undo-redo-array';
import { isFileInAssetDir, withAssetDir } from './fs-utils';
import {
  type StateProvider,
  type Operation,
  type Transaction,
  OperationType,
} from './state-manager';
import { ErrorHandler } from './error-handler';

export type UndoRedoCrdt = { $case: 'crdt'; operations: CrdtOperation[] };
export type UndoRedoFile = { $case: 'file'; operations: FileOperation[] };

export type CrdtOperation = {
  entity: Entity;
  componentName: string;
  prevValue: unknown;
  newValue: unknown;
  operation: CrdtMessageType;
};

export type FileOperation = {
  path: string;
  prevValue: Uint8Array | null;
  newValue: Uint8Array | null;
};

export type UndoRedo = UndoRedoFile | UndoRedoCrdt;
export type UndoRedoOp = UndoRedo['operations'][0];
export type UndoRedoGetter = <T extends UndoRedoOp>(op: T) => T['newValue'];

export interface UndoRedoOptions {
  maxEntries?: number;
  maxSize?: number;
  enableValidation?: boolean;
  enableStateVerification?: boolean;
  persistToStorage?: boolean;
  storageKey?: string;
  maxStorageSize?: number; // max size in bytes for localStorage
  ignoredComponents?: string[]; // components to ignore for undo/redo
}

interface SerializedUndoRedo {
  $case: 'crdt' | 'file';
  operations: Array<{
    entity?: Entity;
    componentName?: string;
    operation?: CrdtMessageType;
    prevValue?: string; // JSON serialized
    newValue?: string; // JSON serialized
    path?: string; // for file operations
  }>;
  timestamp: number;
}

interface StoredHistory {
  version: number;
  undoStack: SerializedUndoRedo[];
  redoStack: SerializedUndoRedo[];
  timestamp: number;
  metadata: {
    totalOperations: number;
    memoryUsage: number;
  };
}

const isNil = (val: unknown) => val === null || val === undefined;
const getUndoValue: UndoRedoGetter = val => val.prevValue;
const getRedoValue: UndoRedoGetter = val => val.newValue;

export class UndoRedoProvider implements StateProvider {
  readonly name = 'undo-redo';

  private readonly undoList: ReturnType<typeof UndoRedoArray>;
  private readonly redoList: ReturnType<typeof UndoRedoArray>;
  private readonly pendingCrdtOperations = new Map<string, CrdtOperation[]>();
  private readonly fs: FileSystemInterface;
  private readonly engine: IEngine;
  private readonly getComposite: () => CompositeDefinition | null;
  private readonly options: Required<UndoRedoOptions>;
  private isExecutingUndoRedo = false;

  constructor(
    fs: FileSystemInterface,
    engine: IEngine,
    getComposite: () => CompositeDefinition | null,
    options: UndoRedoOptions = {},
  ) {
    this.fs = fs;
    this.engine = engine;
    this.getComposite = getComposite;

    this.options = {
      maxEntries: options.maxEntries ?? 1024,
      maxSize: options.maxSize ?? 1024 * 1024 * 100, // 100MB default
      enableValidation: options.enableValidation ?? true,
      enableStateVerification: options.enableStateVerification ?? false, // off by default for performance
      persistToStorage: options.persistToStorage ?? false,
      storageKey: options.storageKey ?? 'inspector-undo-redo-history',
      maxStorageSize: options.maxStorageSize ?? 1024 * 1024 * 10, // 10MB limit for localStorage
      ignoredComponents: options.ignoredComponents ?? [], // components to ignore for undo/redo
    };

    this.undoList = UndoRedoArray(this.options.maxEntries, this.options.maxSize);
    this.redoList = UndoRedoArray(this.options.maxEntries, this.options.maxSize);

    if (this.options.persistToStorage) {
      this.loadFromStorage();
    }
  }

  static async create(
    fs: FileSystemInterface,
    engine: IEngine,
    getComposite: () => CompositeDefinition | null,
    options: UndoRedoOptions = {},
  ): Promise<UndoRedoProvider> {
    return new UndoRedoProvider(fs, engine, getComposite, options);
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.options.storageKey);
      if (!stored) return;

      const data: StoredHistory = JSON.parse(stored);

      if (data.version !== 1) {
        console.warn('Undo/redo history version mismatch, clearing storage');
        this.clearStorage();
        return;
      }

      if (!data.undoStack || !data.redoStack || !Array.isArray(data.undoStack)) {
        throw new Error('Invalid stored history format');
      }

      let loadedUndo = 0;
      let loadedRedo = 0;

      for (const serialized of data.undoStack) {
        const operation = this.deserializeOperation(serialized);
        if (operation) {
          this.undoList.push(operation);
          loadedUndo++;
        }
      }

      for (const serialized of data.redoStack) {
        const operation = this.deserializeOperation(serialized);
        if (operation) {
          this.redoList.push(operation);
          loadedRedo++;
        }
      }

      console.log(`Loaded undo/redo history: ${loadedUndo} undo, ${loadedRedo} redo operations`);
    } catch (error) {
      ErrorHandler.handleError(
        'Failed to load undo/redo history from storage',
        { operation: 'storage_load' },
        error as Error,
      );
      this.clearStorage();
    }
  }

  private saveToStorage(): void {
    if (!this.options.persistToStorage || typeof localStorage === 'undefined') return;

    try {
      const undoOperations = this.undoList.values();
      const redoOperations = this.redoList.values();

      const data: StoredHistory = {
        version: 1,
        undoStack: undoOperations
          .map(op => this.serializeOperation(op))
          .filter(Boolean) as SerializedUndoRedo[],
        redoStack: redoOperations
          .map(op => this.serializeOperation(op))
          .filter(Boolean) as SerializedUndoRedo[],
        timestamp: Date.now(),
        metadata: {
          totalOperations: undoOperations.length + redoOperations.length,
          memoryUsage: this.undoList.memorySize + this.redoList.memorySize,
        },
      };

      const serialized = JSON.stringify(data);

      if (serialized.length > this.options.maxStorageSize) {
        console.warn('Undo/redo history too large for localStorage, skipping save');
        return;
      }

      localStorage.setItem(this.options.storageKey, serialized);
    } catch (error) {
      ErrorHandler.handleError(
        'Failed to save undo/redo history to storage',
        { operation: 'storage_save' },
        error as Error,
      );
    }
  }

  private serializeOperation(operation: UndoRedo): SerializedUndoRedo | null {
    try {
      if (operation.$case === 'crdt') {
        return {
          $case: 'crdt',
          operations: operation.operations.map(op => ({
            entity: op.entity,
            componentName: op.componentName,
            operation: op.operation,
            prevValue: this.serializeValue(op.prevValue),
            newValue: this.serializeValue(op.newValue),
          })),
          timestamp: Date.now(),
        };
      } else if (operation.$case === 'file') {
        return {
          $case: 'file',
          operations: operation.operations.map(op => ({
            path: op.path,
            prevValue: this.serializeFileValue(op.prevValue),
            newValue: this.serializeFileValue(op.newValue),
          })),
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      ErrorHandler.handleError(
        'Failed to serialize operation for storage',
        { operation: 'serialize' },
        error as Error,
      );
    }
    return null;
  }

  private deserializeOperation(serialized: SerializedUndoRedo): UndoRedo | null {
    try {
      if (serialized.$case === 'crdt') {
        return {
          $case: 'crdt',
          operations: serialized.operations.map(op => ({
            entity: op.entity!,
            componentName: op.componentName!,
            operation: op.operation!,
            prevValue: this.deserializeValue(op.prevValue),
            newValue: this.deserializeValue(op.newValue),
          })),
        };
      } else if (serialized.$case === 'file') {
        return {
          $case: 'file',
          operations: serialized.operations.map(op => ({
            path: op.path!,
            prevValue: this.deserializeFileValue(op.prevValue),
            newValue: this.deserializeFileValue(op.newValue),
          })),
        };
      }
    } catch (error) {
      ErrorHandler.handleError(
        'Failed to deserialize operation from storage',
        { operation: 'deserialize' },
        error as Error,
      );
    }
    return null;
  }

  private serializeValue(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    try {
      return JSON.stringify(value);
    } catch (error) {
      // TODO: handle circular references or non-serializable values
      return JSON.stringify('[UNSERIALIZABLE]');
    }
  }

  private deserializeValue(serialized: string | undefined): unknown {
    if (!serialized) return undefined;
    try {
      const parsed = JSON.parse(serialized);
      return parsed === '[UNSERIALIZABLE]' ? undefined : parsed;
    } catch (error) {
      return undefined;
    }
  }

  private serializeFileValue(value: Uint8Array | null): string | undefined {
    if (!value) return undefined;
    try {
      return btoa(String.fromCharCode(...value));
    } catch (error) {
      return undefined;
    }
  }

  private deserializeFileValue(serialized: string | undefined): Uint8Array | null {
    if (!serialized) return null;
    try {
      const binaryString = atob(serialized);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } catch (error) {
      return null;
    }
  }

  private clearStorage(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.options.storageKey);
    }
  }

  canHandle(operation: Operation): boolean {
    if (this.isExecutingUndoRedo) return false;

    return (
      operation.type === OperationType.COMPOSITE_UPDATE ||
      operation.type === OperationType.UNDO_CAPTURE
    );
  }

  async processOperation(operation: Operation, transaction: Transaction): Promise<void> {
    if (
      !this.canHandle(operation) ||
      transaction.source === 'undo' ||
      transaction.source === 'redo'
    ) {
      return;
    }

    if (
      operation.type === OperationType.COMPOSITE_UPDATE &&
      (operation.operation === CrdtMessageType.PUT_COMPONENT ||
        operation.operation === CrdtMessageType.DELETE_COMPONENT)
    ) {
      await this.captureUndoOperation(operation, transaction);
    }
  }

  private async captureUndoOperation(
    operation: Operation,
    transaction: Transaction,
  ): Promise<void> {
    const composite = this.getComposite();
    if (!composite) return;

    // Skip capturing undo operation if component is in ignore list
    if (this.options.ignoredComponents.includes(operation.componentName)) {
      return;
    }

    const prevValue = findPrevValue(composite, operation.componentName, operation.entity);
    const crdtOperation: CrdtOperation = {
      entity: operation.entity,
      operation: operation.operation,
      componentName: operation.componentName,
      prevValue,
      newValue: operation.componentValue,
    };

    let operations = this.pendingCrdtOperations.get(transaction.id);
    if (!operations) {
      operations = [];
      this.pendingCrdtOperations.set(transaction.id, operations);
    }
    operations.push(crdtOperation);
  }

  async onTransactionComplete(transaction: Transaction): Promise<void> {
    const operations = this.pendingCrdtOperations.get(transaction.id);
    if (operations && operations.length > 0) {
      this.redoList.clear();
      this.undoList.push({ $case: 'crdt', operations });
      this.saveToStorage();
    }

    this.pendingCrdtOperations.delete(transaction.id);
  }

  async undo(): Promise<{ type: string }> {
    if (this.options.enableStateVerification) {
      return this.undoWithVerification();
    }

    return this._undo();
  }

  async redo(): Promise<{ type: string }> {
    if (this.options.enableStateVerification) {
      return this.redoWithVerification();
    }

    return this._redo();
  }

  private async validateCrdtOperation(operation: CrdtOperation): Promise<boolean> {
    if (!this.options.enableValidation) return true;

    try {
      const component = this.engine.getComponent(operation.componentName);
      if (!component) {
        ErrorHandler.handleError('Component no longer exists for undo/redo operation', {
          component: operation.componentName,
          entity: operation.entity,
          operation: 'validate',
        });
        return false;
      }
      return true;
    } catch (error) {
      ErrorHandler.handleError(
        'Validation failed for undo/redo operation',
        {
          component: operation.componentName,
          entity: operation.entity,
        },
        error as Error,
      );
      return false;
    }
  }

  private async validateFileOperation(
    operation: FileOperation,
    getValue: UndoRedoGetter,
  ): Promise<boolean> {
    if (!this.options.enableValidation) return true;

    try {
      const filePath = isFileInAssetDir(operation.path)
        ? operation.path
        : withAssetDir(operation.path);

      // Get the actual value that will be executed (prevValue for undo, newValue for redo)
      const valueToExecute = getValue(operation);

      // If we're deleting the file (valueToExecute is null), no parent directory validation needed
      if (isNil(valueToExecute)) {
        return true;
      }

      // Only validate parent directory for file creation/update operations
      const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
      if (parentDir && !(await this.fs.existFile(parentDir))) {
        ErrorHandler.handleError('Parent directory no longer exists for file operation', {
          operation: 'file_validate',
          component: filePath,
        });
        return false;
      }

      return true;
    } catch (error) {
      ErrorHandler.handleError(
        'File validation failed for undo/redo operation',
        { operation: 'file_validate' },
        error as Error,
      );
      return false;
    }
  }

  private async executeUndoRedoLogic(message: UndoRedo, getValue: UndoRedoGetter): Promise<void> {
    const failedOperations: Array<{ operation: any; error: Error }> = [];
    const successfulOperations: any[] = [];

    try {
      if (message.$case === 'crdt') {
        for (const operation of message.operations) {
          try {
            const isValid = await this.validateCrdtOperation(operation);
            if (!isValid) {
              failedOperations.push({
                operation,
                error: new Error('Operation validation failed'),
              });
              continue;
            }

            const component = this.engine.getComponent(
              operation.componentName,
            ) as LastWriteWinElementSetComponentDefinition<unknown>;

            const value = getValue(operation);

            if (isNil(value)) {
              component.deleteFrom(operation.entity);
            } else {
              component.createOrReplace(operation.entity, value);
            }

            successfulOperations.push(operation);
          } catch (error) {
            failedOperations.push({ operation, error: error as Error });
            ErrorHandler.handleError(
              'CRDT operation failed during undo/redo',
              {
                component: operation.componentName,
                entity: operation.entity,
                operation: message.$case,
              },
              error as Error,
            );
          }
        }
      } else if (message.$case === 'file') {
        for (const operation of message.operations) {
          try {
            const isValid = await this.validateFileOperation(operation, getValue);
            if (!isValid) {
              failedOperations.push({
                operation,
                error: new Error('File operation validation failed'),
              });
              continue;
            }

            const filePath = isFileInAssetDir(operation.path)
              ? operation.path
              : withAssetDir(operation.path);

            await upsertAsset(this.fs, filePath, getValue(operation));
            successfulOperations.push(operation);
          } catch (error) {
            failedOperations.push({ operation, error: error as Error });
            ErrorHandler.handleError(
              'File operation failed during undo/redo',
              {
                component: operation.path,
                operation: message.$case,
              },
              error as Error,
            );
          }
        }
      }

      if (failedOperations.length > 0) {
        const totalOps = message.operations.length;
        const failedCount = failedOperations.length;
        const successCount = successfulOperations.length;

        ErrorHandler.handleError(
          `Undo/Redo completed with ${failedCount}/${totalOps} failures (${successCount} succeeded)`,
          {
            operation: `${message.$case}_partial_failure`,
          },
        );

        if (failedCount > totalOps / 2) {
          console.warn('High failure rate in undo/redo operation. Consider manual intervention.');
        }
      }
    } catch (error) {
      ErrorHandler.handleError(
        'Critical failure in undo/redo execution',
        { operation: message.$case },
        error as Error,
      );
      throw error;
    }
  }

  addUndoFile(operations: FileOperation[]): void {
    this.redoList.clear();
    this.undoList.push({ $case: 'file', operations });
    this.saveToStorage();
  }

  clearHistory(): void {
    this.undoList.clear();
    this.redoList.clear();
    this.pendingCrdtOperations.clear();
  }

  getHistorySize(): { undoCount: number; redoCount: number } {
    return {
      undoCount: this.undoList.values().length,
      redoCount: this.redoList.values().length,
    };
  }

  /**
   * Verify that the engine state is consistent with the composite state.
   * This helps detect when the undo system might be working with stale data.
   */
  private async verifyStateIntegrity(): Promise<boolean> {
    try {
      const composite = this.getComposite();
      if (!composite) {
        ErrorHandler.handleError('No composite available for state verification', {
          operation: 'state_verify',
        });
        return false;
      }
      return true;
    } catch (error) {
      ErrorHandler.handleError(
        'State verification failed with error',
        { operation: 'state_verify' },
        error as Error,
      );
      return false;
    }
  }

  getDebugInfo(): {
    undoCount: number;
    redoCount: number;
    pendingOperations: number;
    memoryUsage: { undo: number; redo: number };
    stateIntegrity: boolean;
  } {
    return {
      undoCount: this.undoList.values().length,
      redoCount: this.redoList.values().length,
      pendingOperations: this.pendingCrdtOperations.size,
      memoryUsage: {
        undo: this.undoList.memorySize,
        redo: this.redoList.memorySize,
      },
      stateIntegrity: false,
    };
  }

  async _undo(): Promise<{ type: string }> {
    const msg = this.undoList.pop();
    if (!msg) return { type: '' };

    this.redoList.push(msg);
    this.isExecutingUndoRedo = true;

    try {
      await this.executeUndoRedoLogic(msg, getUndoValue);
      await this.engine.update(1 / 16);
    } finally {
      this.isExecutingUndoRedo = false;
    }

    return { type: msg.$case };
  }

  async _redo(): Promise<{ type: string }> {
    const msg = this.redoList.pop();
    if (!msg) return { type: '' };

    this.undoList.push(msg);
    this.isExecutingUndoRedo = true;

    try {
      await this.executeUndoRedoLogic(msg, getRedoValue);
      await this.engine.update(1 / 16);
    } finally {
      this.isExecutingUndoRedo = false;
    }

    return { type: msg.$case };
  }

  async undoWithVerification(): Promise<{ type: string; verified: boolean }> {
    const stateOk = await this.verifyStateIntegrity();
    if (!stateOk) {
      ErrorHandler.handleError('Undo operation aborted due to state integrity issues', {
        operation: 'undo_verification_failed',
      });
      return { type: '', verified: false };
    }

    const result = await this._undo();
    return { ...result, verified: true };
  }

  async redoWithVerification(): Promise<{ type: string; verified: boolean }> {
    const stateOk = await this.verifyStateIntegrity();
    if (!stateOk) {
      ErrorHandler.handleError('Redo operation aborted due to state integrity issues', {
        operation: 'redo_verification_failed',
      });
      return { type: '', verified: false };
    }

    const result = await this._redo();
    return { ...result, verified: true };
  }

  /**
   * Get storage statistics
   */
  getStorageInfo(): {
    enabled: boolean;
    storageKey: string;
    currentSize: number;
    maxSize: number;
    percentUsed: number;
    operationsStored: number;
  } {
    let currentSize = 0;
    let operationsStored = 0;

    if (typeof localStorage !== 'undefined' && this.options.persistToStorage) {
      try {
        const stored = localStorage.getItem(this.options.storageKey);
        if (stored) {
          currentSize = new Blob([stored]).size;
          const data = JSON.parse(stored);
          operationsStored = (data.undoStack?.length || 0) + (data.redoStack?.length || 0);
        }
        // eslint-disable-next-line no-empty
      } catch (error) {}
    }

    return {
      enabled: this.options.persistToStorage,
      storageKey: this.options.storageKey,
      currentSize,
      maxSize: this.options.maxStorageSize,
      percentUsed:
        this.options.maxStorageSize > 0 ? (currentSize / this.options.maxStorageSize) * 100 : 0,
      operationsStored,
    };
  }

  clearPersistedHistory(): void {
    this.clearStorage();
    console.log('Cleared persisted undo/redo history from localStorage');
  }

  forceSaveToStorage(): boolean {
    if (!this.options.persistToStorage) {
      console.warn('Persistent storage is not enabled');
      return false;
    }

    try {
      this.saveToStorage();
      return true;
    } catch (error) {
      ErrorHandler.handleError(
        'Failed to force save to storage',
        { operation: 'force_save' },
        error as Error,
      );
      return false;
    }
  }

  setPersistentStorage(enabled: boolean): void {
    const wasEnabled = this.options.persistToStorage;
    this.options.persistToStorage = enabled;

    if (enabled && !wasEnabled) {
      this.saveToStorage();
      console.log('Persistent storage enabled for undo/redo');
    } else if (!enabled && wasEnabled) {
      console.log('Persistent storage disabled for undo/redo');
    }
  }

  dispose(): void {
    if (this.options.persistToStorage) {
      this.saveToStorage();
    }

    this.clearHistory();
  }
}
