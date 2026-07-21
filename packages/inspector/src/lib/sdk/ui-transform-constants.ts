// Shared numeric constants for PBUiTransform's enums.
//
// @dcl/ecs declares YGUnit / YGPositionType / YGDisplay as `declare const enum`s
// and does NOT re-export them as runtime values from its public entrypoint
// (dist/index.js re-exports only their *types* via global.gen.d.ts) — so
// `import { YGPositionType } from '@dcl/ecs'` resolves to `undefined` at runtime,
// and cross-module const-enum inlining is disallowed under isolatedModules
// (esbuild/Vite). The SDK's own @dcl/react-ecs inlines the numerics the same way
// (e.g. `1 /* YGUnit.YGU_POINT */`). This module centralizes that convention —
// one source of truth instead of the copies previously scattered across
// Canvas.tsx / align-presets.ts / repair-ui-root.ts. Values are the stable
// wire-format constants in
// node_modules/@dcl/ecs/dist/components/generated/pb/decentraland/sdk/components/ui_transform.gen.d.ts
export const YGU_UNDEFINED = 0; // YGUnit.YGU_UNDEFINED
export const YGU_POINT = 1; // YGUnit.YGU_POINT (px)
export const YGU_PERCENT = 2; // YGUnit.YGU_PERCENT
export const YGU_AUTO = 3; // YGUnit.YGU_AUTO

export const YGPT_RELATIVE = 0; // YGPositionType.YGPT_RELATIVE (in flow)
export const YGPT_ABSOLUTE = 1; // YGPositionType.YGPT_ABSOLUTE

export const YGD_NONE = 1; // YGDisplay.YGD_NONE
