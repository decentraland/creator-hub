import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Entity } from '@dcl/ecs';

import SmartItemControl from './SmartItemControl';

type FieldProps = {
  label: string;
  value?: string | number;
  error?: string;
  options?: { value: string; label: string }[];
  onChange: React.ChangeEventHandler<HTMLInputElement & HTMLSelectElement>;
};

const mocks = vi.hoisted(() => {
  const component = (componentId: number) => ({ componentId });
  return {
    admin: undefined as unknown,
    removedEntities: new Set<number>(),
    setValue: vi.fn(),
    sync: vi.fn(),
    sdk: {
      components: {
        AdminTools: component(1),
        Actions: {
          componentId: 2,
          has: (entity: number) => !mocks.removedEntities.has(entity),
          getOrNull: () => ({ value: [{ name: 'open' }, { name: 'close' }] }),
        },
        Animator: component(3),
        Transform: component(4),
        Tween: component(5),
        VisibilityComponent: component(6),
        VideoPlayer: component(7),
        AudioSource: component(8),
        AudioStream: component(9),
      },
    },
  };
});

vi.mock('../../../../hooks/sdk/useSdk', () => ({ useSdk: () => mocks.sdk }));
vi.mock('../../../../hooks/sdk/useEntitiesWith', () => ({ useEntitiesWith: () => [] }));
vi.mock('../../../../hooks/sdk/useComponentValue', async () => {
  const { useState } = await import('react');
  return {
    useComponentValue: () => {
      const [value, setValue] = useState(mocks.admin);
      const write = (next: unknown) => {
        mocks.setValue(next);
        setValue(next);
      };
      return [value, write];
    },
  };
});
vi.mock('../../../../lib/sdk/operations/entitySyncUtils', () => ({
  addSyncComponentsToEntities: mocks.sync,
}));
vi.mock('../../MoreOptionsMenu', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../../ui', async importOriginal => ({
  ...((await importOriginal()) as object),
  EntityField: ({ label, value, error, onChange }: FieldProps) => (
    <>
      <select
        aria-label={label}
        value={value}
        onChange={onChange}
      >
        <option value="0" />
        <option value="512" />
        <option value="600" />
        <option value="700" />
      </select>
      {error ? <span>{error}</span> : null}
    </>
  ),
  TextField: ({ label, value, onChange }: FieldProps) => (
    <input
      aria-label={label}
      value={value}
      onChange={onChange}
    />
  ),
  Dropdown: ({ label, value, options = [], onChange }: FieldProps) => (
    <select
      aria-label={label}
      value={value}
      onChange={onChange}
    >
      <option value="" />
      {options.map(option => (
        <option
          key={option.value}
          value={option.value}
        >
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

const door = { entity: 512, defaultAction: 'open', customName: 'Door' };
const lamp = { entity: 600, defaultAction: '', customName: 'Lamp' };

function lastWrittenSmartItems() {
  const arg = mocks.setValue.mock.lastCall?.[0];
  const written = typeof arg === 'function' ? arg(mocks.admin) : arg;
  return written.smartItemsControl.smartItems;
}

function lastSyncedEntities() {
  return mocks.sync.mock.lastCall?.[1];
}

describe('SmartItemControl', () => {
  beforeEach(() => {
    mocks.admin = {
      smartItemsControl: { isEnabled: true, linkAllSmartItems: false, smartItems: [door, lamp] },
    };
  });

  afterEach(() => {
    cleanup();
    mocks.removedEntities.clear();
    vi.clearAllMocks();
  });

  describe('when mounted before the Actions entity list has loaded', () => {
    beforeEach(() => {
      render(<SmartItemControl entity={1 as Entity} />);
    });

    it('should not write to the AdminTools component', () => {
      expect(mocks.setValue).not.toHaveBeenCalled();
    });

    it('should sync every picked smart item', () => {
      expect(lastSyncedEntities()).toEqual([512, 600]);
    });
  });

  describe('when a smart item entity is picked', () => {
    beforeEach(() => {
      render(<SmartItemControl entity={1 as Entity} />);
      fireEvent.change(screen.getAllByLabelText('Smart Item')[1], { target: { value: '700' } });
    });

    it("should change only that row's entity", () => {
      expect(lastWrittenSmartItems()).toEqual([door, { ...lamp, entity: 700 }]);
    });

    it('should sync the picked entity', () => {
      expect(lastSyncedEntities()).toEqual([512, 700]);
    });
  });

  describe('when a row is removed', () => {
    beforeEach(() => {
      render(<SmartItemControl entity={1 as Entity} />);
      fireEvent.click(screen.getAllByText('Remove')[0]);
    });

    it('should drop that row and keep the others in order', () => {
      expect(lastWrittenSmartItems()).toEqual([lamp]);
    });
  });

  describe("when a row's entity no longer has Actions", () => {
    beforeEach(() => {
      mocks.removedEntities.add(600);
      render(<SmartItemControl entity={1 as Entity} />);
    });

    it('should flag that row as removed', () => {
      expect(screen.getAllByText('Smart item was removed')).toHaveLength(1);
    });

    it('should keep the row instead of pruning it', () => {
      expect(mocks.setValue).not.toHaveBeenCalled();
    });
  });
});
