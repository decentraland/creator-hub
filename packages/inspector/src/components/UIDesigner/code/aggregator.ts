// File-per-root codegen: each UI root is its own component file
// (src/ui/<Name>.tsx) with a typed `state` binding surface, and a generated
// src/ui/index.tsx composes them into setupUi(). Consumed by code/store.ts.

export interface UiRoot {
  // Exported component name, e.g. "MyScreen".
  component: string;
  // Import specifier relative to ui/index.tsx, e.g. "./MyScreen".
  from: string;
}

// Generate the ui/index.tsx aggregator source that composes every root under a
// full-screen container and wires it to the SDK UI renderer.
export function generateUiIndex(roots: UiRoot[]): string {
  const imports = roots.map(r => `import { ${r.component} } from '${r.from}'`).join('\n');
  const children = roots.map(r => `        <${r.component} />`).join('\n');
  return `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, ReactEcsRenderer } from '@dcl/sdk/react-ecs'
${imports}

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(() => (
    <UiEntity uiTransform={{ width: '100%', height: '100%' }}>
${children}
    </UiEntity>
  ))
}
`;
}

// A starter root component file for a newly created root.
export function generateRootComponent(component: string): string {
  return `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, Label } from '@dcl/sdk/react-ecs'

export interface State {}
export const state: State = {}

export function ${component}() {
  return (
    <UiEntity uiTransform={{ width: 400, height: 200, positionType: 'absolute', position: { top: 40, left: 40 } }}>
      <Label value="${component}" fontSize={32} uiTransform={{ width: 360, height: 48, margin: { top: 16, left: 16 } }} />
    </UiEntity>
  )
}
`;
}
