import { CameraMode as ProtoCameraMode } from '../../data-layer/proto/gen/data-layer.gen';

// Internal type using string literals for JSON compatibility
export type CameraMode = 'orbit' | 'free';

export type InspectorPreferences = {
  cameraMode: CameraMode;
  freeCameraInvertRotation: boolean;
  autosaveEnabled: boolean;
};

export function getDefaultInspectorPreferences(): InspectorPreferences {
  return {
    cameraMode: 'orbit', // Default to orbit camera (ArcRotateCamera)
    freeCameraInvertRotation: false,
    autosaveEnabled: true,
  };
}

// Conversion helpers between internal string types and proto enum
export function cameraModeToProto(mode: CameraMode): ProtoCameraMode {
  switch (mode) {
    case 'orbit':
      return ProtoCameraMode.ORBIT;
    case 'free':
      return ProtoCameraMode.FREE;
    default:
      return ProtoCameraMode.ORBIT;
  }
}

export function cameraModeFromProto(mode: ProtoCameraMode): CameraMode {
  switch (mode) {
    case ProtoCameraMode.ORBIT:
      return 'orbit';
    case ProtoCameraMode.FREE:
      return 'free';
    default:
      return 'orbit';
  }
}
