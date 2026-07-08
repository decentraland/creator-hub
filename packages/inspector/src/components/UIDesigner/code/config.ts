// Feature flag for the experimental "code as source of truth" UI Designer mode
// (PoC). When on, the UI Designer reads/writes real @dcl/react-ecs .tsx code
// via the OXC parse-RPC bridge instead of the ECS composite / UIDesign
// pipeline. Off by default; toggle in the inspector iframe devtools with:
//   localStorage.setItem('UI_DESIGNER_CODE_MODE', 'true')  // then reload
// Code-mode is Electron-only (the native parser lives in CH main).
function readFlag(): boolean {
  try {
    return (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('UI_DESIGNER_CODE_MODE') === 'true'
    );
  } catch {
    return false;
  }
}

export const UI_DESIGNER_CODE_MODE = readFlag();
