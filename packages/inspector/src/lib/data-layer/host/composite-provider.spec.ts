import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrdtMessageType, type Entity, type IEngine } from '@dcl/ecs';

import type { InspectorPreferences } from '../../logic/preferences/types';
import type { FileSystemInterface } from '../types';
import type * as EngineToComposite from './utils/engine-to-composite';
import type { CompositeManager } from './utils/fs-composite-provider';
import { type Operation, OperationType, type Transaction } from './state-manager';
import { CompositeProvider } from './composite-provider';

const mocks = vi.hoisted(() => ({
  dumpEngineToComposite: vi.fn(),
  generateEntityNamesType: vi.fn(async () => {}),
}));

vi.mock('./utils/engine-to-composite', async importOriginal => ({
  ...(await importOriginal<typeof EngineToComposite>()),
  dumpEngineToComposite: mocks.dumpEngineToComposite,
  generateEntityNamesType: mocks.generateEntityNamesType,
}));

const COMPOSITE_PATH = 'assets/scene/main.composite';
const MIN_SAVE_INTERVAL = 100;

function transaction(id: string): Transaction {
  return { id, operations: [], source: 'engine', completed: false };
}

function compositeOperation(): Operation {
  return {
    type: OperationType.COMPOSITE_UPDATE,
    entity: 512 as Entity,
    componentName: 'core::Transform',
    operation: CrdtMessageType.PUT_COMPONENT,
    timestamp: 0,
    componentValue: {},
  };
}

describe('CompositeProvider', () => {
  let save: ReturnType<typeof vi.fn>;
  let provider: CompositeProvider;
  let preferences: InspectorPreferences;

  function savedCompositeVersions() {
    return save.mock.calls.map(([arg]) => arg.composite.version);
  }

  async function completeTransaction(id: string) {
    const tx = transaction(id);
    await provider.processOperation(compositeOperation(), tx);
    await provider.onTransactionComplete(tx);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    preferences = { autosaveEnabled: true } as InspectorPreferences;
    save = vi.fn(async () => {});
    let version = 0;
    mocks.dumpEngineToComposite.mockImplementation(() => ({ version: ++version, components: [] }));
    provider = new CompositeProvider(
      {} as FileSystemInterface,
      {} as IEngine,
      () => preferences,
      COMPOSITE_PATH,
    );
    Object.assign(provider, {
      compositeManager: { save } as unknown as CompositeManager,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('when a single transaction completes with autosave enabled', () => {
    beforeEach(async () => {
      await completeTransaction('tx-1');
    });

    it('should save it immediately', () => {
      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a second transaction completes inside the minimum save interval', () => {
    beforeEach(async () => {
      await completeTransaction('tx-1');
      await vi.advanceTimersByTimeAsync(MIN_SAVE_INTERVAL / 2);
      await completeTransaction('tx-2');
    });

    it('should not save it straight away', () => {
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('should still be dirty while the save is pending', () => {
      expect(provider.isDirty()).toBe(true);
    });

    it('should save once the interval has elapsed', async () => {
      await vi.advanceTimersByTimeAsync(MIN_SAVE_INTERVAL);

      expect(save).toHaveBeenCalledTimes(2);
    });

    it('should save the latest state rather than replaying the first snapshot', async () => {
      await vi.advanceTimersByTimeAsync(MIN_SAVE_INTERVAL);

      expect(savedCompositeVersions()).toEqual([1, 2]);
    });

    it('should be clean afterwards', async () => {
      await vi.advanceTimersByTimeAsync(MIN_SAVE_INTERVAL);

      expect(provider.isDirty()).toBe(false);
    });
  });

  describe('when several transactions complete inside the minimum save interval', () => {
    beforeEach(async () => {
      await completeTransaction('tx-1');
      await completeTransaction('tx-2');
      await completeTransaction('tx-3');
      await completeTransaction('tx-4');
    });

    it('should collapse them into a single trailing save', async () => {
      await vi.advanceTimersByTimeAsync(MIN_SAVE_INTERVAL);

      expect(save).toHaveBeenCalledTimes(2);
    });
  });

  describe('when autosave is disabled', () => {
    beforeEach(async () => {
      preferences = { autosaveEnabled: false } as InspectorPreferences;
      await completeTransaction('tx-1');
    });

    it('should never save', async () => {
      await vi.advanceTimersByTimeAsync(MIN_SAVE_INTERVAL * 4);

      expect(save).not.toHaveBeenCalled();
    });
  });
});
