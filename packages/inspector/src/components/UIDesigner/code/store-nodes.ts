import { nodeLabelText } from '../shared/tree-model';
import { type InteractionStateKey } from './interaction-convention';
import { isLayerableComponent, UI_BUTTON } from './parse-adapter';
import type { CodeUINode, InteractionStateStyles } from './types';
import { state } from './store-core';

export function astNodeFor(entityId: number): unknown | undefined {
  return state.parsed?.astNodes.get(entityId);
}

export function collectNodeLabels(root: CodeUINode | undefined, exceptId?: number): string[] {
  const out: string[] = [];
  const walk = (n: CodeUINode): void => {
    if ((n.entity as unknown as number) !== exceptId) out.push(nodeLabelText(n));
    n.children.forEach(walk);
  };
  if (root) walk(root);
  return out;
}

export function findCodeNode(
  root: CodeUINode | undefined,
  entityId: number,
): CodeUINode | undefined {
  if (!root) return undefined;
  if ((root.entity as unknown as number) === entityId) return root;
  for (const child of root.children) {
    const found = findCodeNode(child, entityId);
    if (found) return found;
  }
  return undefined;
}

export function findCodeLayoutParent(
  root: CodeUINode | undefined,
  entityId: number,
  inheritedParent?: CodeUINode,
): CodeUINode | undefined {
  if (!root) return undefined;
  const asParent = root.platformVariant ? inheritedParent : root;
  for (const child of root.children) {
    if ((child.entity as unknown as number) === entityId) return asParent;
    const found = findCodeLayoutParent(child, entityId, asParent);
    if (found) return found;
  }
  return undefined;
}

export const COMPONENT_FIELD: Record<string, keyof InteractionStateStyles> = {
  'core::UiTransform': 'uiTransform',
  'core::UiBackground': 'uiBackground',
  'core::UiText': 'uiText',
  'core::UiInput': 'uiInput',
  'core::UiDropdown': 'uiDropdown',
};

export function codeComponentValue(
  node: CodeUINode | undefined,
  componentId: string,
): Record<string, unknown> | null {
  if (!node) return null;
  if (componentId === UI_BUTTON) return node.uiButton ?? null;
  const field = COMPONENT_FIELD[componentId];
  if (!field) return null;
  return (node[field] as Record<string, unknown>) ?? null;
}

export function codeComponentValueForLayer(
  node: CodeUINode | undefined,
  componentId: string,
  layer: InteractionStateKey,
): Record<string, unknown> | null {
  if (!node?.interaction || layer === 'base' || !isLayerableComponent(componentId)) {
    return codeComponentValue(node, componentId);
  }
  const field = COMPONENT_FIELD[componentId];
  if (!field) return null;
  const base = node.interaction.states.base?.[field] ?? {};
  const own = node.interaction.states[layer]?.[field];
  if (!own) return (base as Record<string, unknown>) ?? null;
  return { ...base, ...own };
}

export function interactionLayerValue(
  node: CodeUINode | undefined,
  componentId: string,
  layer: InteractionStateKey,
): Record<string, unknown> | null {
  const field = COMPONENT_FIELD[componentId];
  if (!node?.interaction || !field) return null;
  return (node.interaction.states[layer]?.[field] as Record<string, unknown>) ?? null;
}

export function guardElementWrite(entityId: number, opName: string): boolean {
  const node = findCodeNode(state.parsed?.root, entityId);
  if (node?.componentRef) {
    console.warn(
      `[code-mode] ${opName}: <${node.componentRef.name} /> takes only its declared props — move/size its wrapper UiEntity instead`,
    );
    return false;
  }
  if (node?.opaque) {
    console.warn(`[code-mode] ${opName}: opaque node — edit it in code instead`);
    return false;
  }
  if (node?.platformVariant) {
    console.warn(`[code-mode] ${opName}: platform variant — select one of its branches`);
    return false;
  }
  if (node?.dynamicProps) {
    console.warn(
      `[code-mode] ${opName}: node has dynamic props (bindings/spreads in uiTransform or uiBackground) — edit it in code instead`,
    );
    return false;
  }
  return true;
}
