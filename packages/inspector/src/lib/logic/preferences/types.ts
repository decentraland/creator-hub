export type Vec3Pref = { x: number; y: number; z: number };

export type InspectorPreferences = {
  freeCameraInvertRotation: boolean;
  autosaveEnabled: boolean;
  cameraPosition?: Vec3Pref;
  cameraTarget?: Vec3Pref;
};

export function getDefaultInspectorPreferences(): InspectorPreferences {
  return {
    freeCameraInvertRotation: false,
    autosaveEnabled: true,
  };
}
