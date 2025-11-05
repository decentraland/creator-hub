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
