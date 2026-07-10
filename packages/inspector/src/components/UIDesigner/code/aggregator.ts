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
  // Emit-sink backstop: the component name is spliced verbatim into `import`/JSX,
  // so reject any non-identifier here even if a caller bypasses the refreshRoots
  // trust boundary (mirrors engine-to-composite's toSafeIdentifier chokepoint).
  // Filter (not throw) so one bad root can't break the whole aggregator.
  const VALID = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const safeRoots = roots.filter(r => {
    if (VALID.test(r.component)) return true;
    console.warn('[code-mode] skipping root with non-identifier component name', r.component);
    return false;
  });
  const imports = safeRoots.map(r => `import { ${r.component} } from '${r.from}'`).join('\n');
  const children = safeRoots.map(r => `        <${r.component} />`).join('\n');
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
