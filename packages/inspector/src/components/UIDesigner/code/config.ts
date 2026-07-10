// This branch is CODE-MODE ONLY: the UI Designer's single source of truth is the
// scene's real @dcl/react-ecs .tsx code (canvas + Monaco). The ECS composite UI
// path is no longer used here.
//
// The constant is kept (always true) so the legacy composite branches inside
// Canvas / useUINodeActions remain dead code until a dedicated cleanup removes
// them; the entry points (UIDesigner, the left rail, useUINodeTree) no longer
// branch on it.
export const UI_DESIGNER_CODE_MODE = true;
