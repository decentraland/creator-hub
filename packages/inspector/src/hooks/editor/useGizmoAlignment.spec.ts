import { act } from 'react-dom/test-utils';
import { renderHook } from '@testing-library/react';
import mitt from 'mitt';
import { CrdtMessageType } from '@dcl/ecs';
import type { Entity } from '@dcl/ecs';

import type { SdkContextValue } from '../../lib/sdk/context';
import { CoreComponents } from '../../lib/sdk/components';
import { useChange } from '../sdk/useChange';
import { useSdk } from '../sdk/useSdk';
import { useGizmoAlignment } from './useGizmoAlignment';

// renderer.gizmos mock (the renderer-agnostic contract surface)
const gizmoManagerEvents = mitt();
const mockEntity = 0 as Entity;
const gizmoManagerMock = {
  isWorldAligned: vi.fn().mockReturnValue(true),
  isWorldAlignmentDisabled: vi.fn().mockReturnValue(false),
  setWorldAligned: vi.fn(),
  onChange: vi.fn().mockImplementation(cb => gizmoManagerEvents.on('*', cb)),
};

// useSdk mock
vi.mock('../sdk/useSdk');
const useSdkMock = useSdk as vi.MockedFunction<typeof useSdk>;
const sdkMock = {
  components: { Transform: { componentId: CoreComponents.TRANSFORM } },
  renderer: { gizmos: gizmoManagerMock },
} as unknown as SdkContextValue;
useSdkMock.mockImplementation(cb => {
  cb && cb(sdkMock);
  return sdkMock;
});

// useChange mock
vi.mock('../sdk/useChange');
const engineEvents = mitt();
const useChangeMock = useChange as vi.MockedFunction<typeof useChange>;
const mockEvent = {
  entity: mockEntity,
  component: sdkMock.components.Transform,
  operation: CrdtMessageType.PUT_COMPONENT,
  value: {},
};
useChangeMock.mockImplementation(cb => {
  cb && engineEvents.on('*', () => cb(mockEvent, sdkMock));
});

describe('useGizmoAlignment', () => {
  afterEach(() => {
    useSdkMock.mockClear();
    gizmoManagerMock.isWorldAligned.mockClear();
    gizmoManagerMock.isWorldAlignmentDisabled.mockClear();
    gizmoManagerMock.setWorldAligned.mockClear();
    gizmoManagerMock.onChange.mockClear();
    gizmoManagerEvents.all.clear();
    engineEvents.all.clear();
  });
  describe('When the hook is mounted ', () => {
    it('should sync the state with the gizmo manager', () => {
      const { result } = renderHook(() => useGizmoAlignment());
      const { isGizmoWorldAligned } = result.current;
      expect(isGizmoWorldAligned).toBe(true);
      expect(gizmoManagerMock.isWorldAligned).toHaveBeenCalled();
    });
    it('should add a listener for the onChange event of the gizmoManager', () => {
      renderHook(() => useGizmoAlignment());
      expect(gizmoManagerMock.onChange).toHaveBeenCalled();
    });
    it('should not update the renderer', () => {
      renderHook(() => useGizmoAlignment());
      expect(gizmoManagerMock.setWorldAligned).not.toHaveBeenCalled();
    });
  });
  describe('When the hook state is changed ', () => {
    it('should update the renderer', () => {
      const { result } = renderHook(() => useGizmoAlignment());
      const { setGizmoWorldAligned } = result.current;
      expect(result.current.isGizmoWorldAligned).toBe(true);
      gizmoManagerMock.isWorldAligned.mockReturnValue(true);
      act(() => {
        setGizmoWorldAligned(false);
      });
      expect(result.current.isGizmoWorldAligned).toBe(false);
      expect(gizmoManagerMock.setWorldAligned).toHaveBeenCalledWith(false);
    });
  });
  describe('When a change happens in the renderer', () => {
    it('should update the hook state', () => {
      renderHook(() => useGizmoAlignment());
      gizmoManagerMock.isWorldAligned.mockClear();
      gizmoManagerMock.isWorldAlignmentDisabled.mockReset();
      gizmoManagerMock.isWorldAlignmentDisabled.mockReturnValue(true);
      gizmoManagerEvents.emit('*');
      expect(gizmoManagerMock.isWorldAligned).toHaveBeenCalled();
      expect(gizmoManagerMock.isWorldAlignmentDisabled).toHaveBeenCalled();
    });
  });
});
