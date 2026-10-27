import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Entity } from '@dcl/ecs';

import type { FieldConfig } from '../field-configs';
import { LengthVecField } from './LengthVecField';

vi.mock('../BindableField', () => ({
  BindableField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../BindableSubField', () => ({
  BindableSubField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../../../../redux/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ uiDesigner: { aspectLocked: {} } }),
  useAppDispatch: () => vi.fn(),
}));

const field = {
  componentId: 'uiTransform',
  path: 'size',
  kind: 'lengthVec',
  aspectLockable: true,
  subFields: [
    { path: 'width', leftLabel: 'W' },
    { path: 'height', leftLabel: 'H' },
  ],
} as unknown as FieldConfig;

const lockOf = (fieldDisabled: boolean) =>
  render(
    <LengthVecField
      field={field}
      componentValue={{ width: 10, height: 10 }}
      entity={1 as Entity}
      fieldDisabled={fieldDisabled}
      onPatch={vi.fn()}
    />,
  ).getByLabelText('Lock aspect ratio') as HTMLButtonElement;

describe('LengthVecField aspect lock', () => {
  describe('when the field is disabled', () => {
    it('should disable the aspect lock', () => {
      expect(lockOf(true).disabled).toBe(true);
    });
  });

  describe('when the field is enabled', () => {
    it('should leave the aspect lock enabled', () => {
      expect(lockOf(false).disabled).toBe(false);
    });
  });
});
