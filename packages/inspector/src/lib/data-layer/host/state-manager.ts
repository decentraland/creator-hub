import type {
  ComponentDefinition,
  CompositeDefinition,
  Entity,
  IEngine,
  OnChangeFunction,
} from '@dcl/ecs';
import { CrdtMessageType } from '@dcl/ecs';
import type { FileSystemInterface } from '../types';
import type { InspectorPreferences } from '../../logic/preferences/types';
import { EditorComponentNames } from '../../sdk/components';
import { ErrorHandler } from './error-handler';

export enum OperationType {
  SCENE_UPDATE = 'scene_update',
  COMPOSITE_UPDATE = 'composite_update',
  UNDO_CAPTURE = 'undo_capture',
  FILE_OPERATION = 'file_operation',
}

export interface BaseOperation {
  type: OperationType;
  entity: Entity;
  componentName: string;
  operation: CrdtMessageType;
  timestamp: number;
}

export interface SceneOperation extends BaseOperation {
  type: OperationType.SCENE_UPDATE;
  componentValue: unknown;
}

export interface CompositeOperation extends BaseOperation {
  type: OperationType.COMPOSITE_UPDATE;
  componentValue: unknown;
}

export interface UndoCaptureOperation extends BaseOperation {
  type: OperationType.UNDO_CAPTURE;
  componentValue: unknown;
}

export type Operation = SceneOperation | CompositeOperation | UndoCaptureOperation;

export interface Transaction {
  id: string;
  operations: Operation[];
  source: 'engine' | 'undo' | 'redo' | 'external';
  completed: boolean;
}

export interface StateProvider {
  readonly name: string;
  canHandle(operation: Operation): boolean;
  processOperation(operation: Operation, transaction: Transaction): Promise<void>;
  onTransactionComplete(transaction: Transaction): Promise<void>;
}

export interface StateManagerOptions {
  fs: FileSystemInterface;
  engine: IEngine;
  getInspectorPreferences: () => InspectorPreferences;
  compositePath: string;
}

export class StateManager {
  private providers = new Map<string, StateProvider>();
  private pendingTransaction: Transaction | null = null;
  private transactionQueue: Transaction[] = [];
  private processing = false;
  private readonly maxBatchSize = 50; // prevent oversized batches
  private readonly fs: FileSystemInterface;
  private readonly engine: IEngine;
  private readonly getInspectorPreferences: () => InspectorPreferences;
  private readonly compositePath: string;
  private pendingTimeouts = new Set<NodeJS.Timeout>();

  constructor(options: StateManagerOptions) {
    this.fs = options.fs;
    this.engine = options.engine;
    this.getInspectorPreferences = options.getInspectorPreferences;
    this.compositePath = options.compositePath;
  }

  registerProvider(provider: StateProvider): void {
    this.providers.set(provider.name, provider);
  }

  unregisterProvider(name: string): void {
    this.providers.delete(name);
  }

  getProvider<T extends StateProvider>(name: string): T | undefined {
    return this.providers.get(name) as T;
  }

  createOnChangeHandler(): OnChangeFunction {
    return (entity, operation, component, componentValue) => {
      if (this.processing) return;

      const opType = this.determineOperationType(operation, component);
      const baseOp = {
        entity,
        componentName: component?.componentName || 'unknown',
        operation,
        timestamp: Date.now(),
      };

      let op: Operation;
      switch (opType) {
        case OperationType.SCENE_UPDATE:
          op = { ...baseOp, type: OperationType.SCENE_UPDATE, componentValue };
          break;
        case OperationType.COMPOSITE_UPDATE:
          op = { ...baseOp, type: OperationType.COMPOSITE_UPDATE, componentValue };
          break;
        case OperationType.UNDO_CAPTURE:
          op = { ...baseOp, type: OperationType.UNDO_CAPTURE, componentValue };
          break;
        default:
          op = { ...baseOp, type: OperationType.UNDO_CAPTURE, componentValue };
      }

      this.addToCurrentTransaction(op);
    };
  }

  private determineOperationType(
    operation: CrdtMessageType,
    component: ComponentDefinition<unknown> | undefined,
  ): OperationType {
    if (!component) return OperationType.COMPOSITE_UPDATE;

    switch (component.componentName) {
      case EditorComponentNames.Scene:
        return OperationType.SCENE_UPDATE;
      case EditorComponentNames.Selection:
        return OperationType.UNDO_CAPTURE;
      default:
        if (
          operation === CrdtMessageType.PUT_COMPONENT ||
          operation === CrdtMessageType.DELETE_COMPONENT
        ) {
          return OperationType.COMPOSITE_UPDATE;
        }
        return OperationType.UNDO_CAPTURE;
    }
  }

  private addToCurrentTransaction(operation: Operation): void {
    if (!this.pendingTransaction) {
      this.pendingTransaction = {
        id: crypto.randomUUID(),
        operations: [],
        source: 'engine',
        completed: false,
      };

      /**
       * Use setTimeout(0) to batch operations into a single transaction.
       *
       * This delays the transaction commit until the next tick of the event loop,
       * allowing multiple synchronous operations to be grouped together.
       *
       * Example without batching:
       *   component1.update() → Transaction 1 → Process → Complete
       *   component2.update() → Transaction 2 → Process → Complete
       *   component3.update() → Transaction 3 → Process → Complete
       *
       * Example with batching (more efficient? probably):
       *   component1.update() → \
       *   component2.update() → → Single Transaction → Process → Complete
       *   component3.update() → /
       */
      const timeoutId = setTimeout(() => {
        this.pendingTimeouts.delete(timeoutId);
        this.commitPendingTransaction();
      }, 0);
      this.pendingTimeouts.add(timeoutId);
    }

    this.pendingTransaction.operations.push(operation);

    // force commit if batch gets too large to prevent memory issues
    if (this.pendingTransaction.operations.length >= this.maxBatchSize) {
      this.commitPendingTransaction();
    }
  }

  private async commitPendingTransaction(): Promise<void> {
    if (!this.pendingTransaction || this.pendingTransaction.operations.length === 0) {
      this.pendingTransaction = null;
      return;
    }

    const transaction = this.pendingTransaction;
    this.pendingTransaction = null;
    transaction.completed = true;

    this.transactionQueue.push(transaction);
    await this.processTransactionQueue();
  }

  private async processTransactionQueue(): Promise<void> {
    if (this.processing || this.transactionQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.transactionQueue.length > 0) {
        const transaction = this.transactionQueue.shift()!;
        await this.processTransaction(transaction);
      }
    } catch (error) {
      console.error('Error processing transaction queue:', error);
    } finally {
      this.processing = false;
    }
  }

  private async processTransaction(transaction: Transaction): Promise<void> {
    const providers = Array.from(this.providers.values());

    for (const provider of providers) {
      const handledOperations = transaction.operations.filter(op => provider.canHandle(op));

      if (handledOperations.length > 0) {
        try {
          await Promise.allSettled(
            handledOperations.map(op => provider.processOperation(op, transaction)),
          );
        } catch (error) {
          ErrorHandler.handleError(
            'Provider failed to process operations',
            { provider: provider.name, transaction: transaction.id },
            error as Error,
          );
        }
      }
    }

    // complete transactions sequentially to maintain consistency
    for (const provider of providers) {
      try {
        await provider.onTransactionComplete(transaction);
      } catch (error) {
        ErrorHandler.handleError(
          'Provider failed to complete transaction',
          { provider: provider.name, transaction: transaction.id },
          error as Error,
        );
      }
    }
  }

  async executeTransaction<T>(
    source: Transaction['source'],
    operations: () => Promise<T>,
  ): Promise<T> {
    if (this.processing) {
      throw new Error('Cannot execute transaction while processing');
    }

    const wasProcessing = this.processing;
    this.processing = true;

    try {
      return await operations();
    } finally {
      this.processing = wasProcessing;
      await this.processTransactionQueue();
    }
  }

  getComposite(): CompositeDefinition | null {
    const compositeProvider = this.getProvider('composite');
    return (compositeProvider as any)?.getComposite?.() || null;
  }

  async dispose(): Promise<void> {
    for (const timeout of Array.from(this.pendingTimeouts)) {
      clearTimeout(timeout);
    }
    this.pendingTimeouts.clear();

    if (this.pendingTransaction) {
      await this.commitPendingTransaction();
    }

    while (this.transactionQueue.length > 0) {
      await this.processTransactionQueue();
    }

    this.providers.clear();
  }
}
