import { act } from 'react-dom/test-utils';
import { renderHook } from '@testing-library/react';
import mitt from 'mitt';
import { CrdtMessageType } from '@dcl/ecs';
import type { Entity } from '@dcl/ecs';

import { createGizmoManager } from '../../lib/babylon/decentraland/GizmoManager';
import type { EcsEntity } from '../../lib/babylon/decentraland/EcsEntity';
import type { SdkContextValue } from '../../lib/sdk/context';
import { CoreComponents } from '../../lib/sdk/components';
import { useChange } from '../sdk/useChange';
import { useSdk } from '../sdk/useSdk';
import { useGizmoAlignment } from './useGizmoAlignment';

// gizmoManager mock
vi.mock('../../lib/babylon/decentraland/GizmoManager');
const createGizmoManagerMock = createGizmoManager as vi.MockedFn<typeof createGizmoManager>;
const gizmoManagerEvents = mitt();
const mockEntity = 0 as Entity;
const gizmoManagerMock = {
  getEntity: vi.fn().mockReturnValue({ entityId: mockEntity } as EcsEntity),
  isGizmoWorldAligned: vi.fn().mockReturnValue(true),
  isGizmoWorldAlignmentDisabled: vi.fn().mockReturnValue(false),
  setGizmoWorldAligned: vi.fn(),
  onChange: vi.fn().mockImplementation(cb => gizmoManagerEvents.on('*', cb)),
};
createGizmoManagerMock.mockReturnValue(
  gizmoManagerMock as unknown as ReturnType<typeof createGizmoManager>,
);

// useSdk mock
vi.mock('../sdk/useSdk');
const useSdkMock = useSdk as vi.MockedFunction<typeof useSdk>;
const sdkMock = {
  scene: {},
  components: { Transform: { componentId: CoreComponents.TRANSFORM } },
  gizmos: gizmoManagerMock,
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
    createGizmoManagerMock.mockClear();
    gizmoManagerMock.isGizmoWorldAligned.mockClear();
    gizmoManagerMock.isGizmoWorldAlignmentDisabled.mockClear();
    gizmoManagerMock.setGizmoWorldAligned.mockClear();
    gizmoManagerMock.onChange.mockClear();
    gizmoManagerEvents.all.clear();
    engineEvents.all.clear();
  });
  describe('When the hook is mounted ', () => {
    it('should sync the state with the gizmo manager', () => {
      const { result } = renderHook(() => useGizmoAlignment());
      const { isGizmoWorldAligned } = result.current;
      expect(isGizmoWorldAligned).toBe(true);
      expect(gizmoManagerMock.isGizmoWorldAligned).toHaveBeenCalled();
    });
    it('should add a listener for the onChange event of the gizmoManager', () => {
      renderHook(() => useGizmoAlignment());
      expect(gizmoManagerMock.onChange).toHaveBeenCalled();
    });
    it('should not update the renderer', () => {
      renderHook(() => useGizmoAlignment());
      expect(gizmoManagerMock.setGizmoWorldAligned).not.toHaveBeenCalled();
    });
  });
  describe('When the hook state is changed ', () => {
    it('should update the renderer', () => {
      const { result } = renderHook(() => useGizmoAlignment());
      const { setGizmoWorldAligned } = result.current;
      expect(result.current.isGizmoWorldAligned).toBe(true);
      gizmoManagerMock.isGizmoWorldAligned.mockReturnValue(true);
      act(() => {
        setGizmoWorldAligned(false);
      });
      expect(result.current.isGizmoWorldAligned).toBe(false);
      expect(gizmoManagerMock.setGizmoWorldAligned).toHaveBeenCalledWith(false);
    });
  });
  describe('When a change happens in the renderer', () => {
    it('should update the hook state', () => {
      renderHook(() => useGizmoAlignment());
      gizmoManagerMock.isGizmoWorldAligned.mockClear();
      gizmoManagerMock.isGizmoWorldAlignmentDisabled.mockReset();
      gizmoManagerMock.isGizmoWorldAlignmentDisabled.mockReturnValue(true);
      gizmoManagerEvents.emit('*');
      expect(gizmoManagerMock.isGizmoWorldAligned).toHaveBeenCalled();
      expect(gizmoManagerMock.isGizmoWorldAlignmentDisabled).toHaveBeenCalled();
    });
  });
});
