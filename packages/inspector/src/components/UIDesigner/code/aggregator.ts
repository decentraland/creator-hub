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

// A starter root component file for a newly created root — an EMPTY component
// (a plain `return`, no elements). The editor treats this as a valid empty GUI
// and shows a "drop your first element" canvas; the first widget added splices
// the `return (<…/>)` (see store.spliceSetRootChild). Starting empty makes it
// easy to build reusable components, not just full screens. `ReactEcs` stays
// imported (the JSX pragma references it); element imports are added on demand.
// The `props: {}` param is always present so the `UiAction` args type can refer
// to `Parameters<typeof ${component}>[0]` (see the callbacks contract).
export function generateRootComponent(component: string): string {
  return `/** @jsx ReactEcs.createElement */
import ReactEcs from '@dcl/sdk/react-ecs'

export interface State {}
export const state: State = {}

export function ${component}(props: {}) {
  return
}
`;
}
