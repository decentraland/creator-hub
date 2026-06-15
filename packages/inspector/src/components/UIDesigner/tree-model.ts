import type { Entity, IEngine } from '@dcl/ecs';
import { ComponentName, SegmentKind } from '@dcl/asset-packs';

export type UINodeType = 'UiEntity' | 'Label' | 'Button' | 'Input' | 'Dropdown';

// Default design/virtual resolution for a UI. Authors can override it per UI
// (stored on the `asset-packs::UI` marker as canvasWidth/canvasHeight); this is
// the fallback for new UIs and for legacy roots created before the field existed.
// It is also the runtime virtualWidth/virtualHeight the UI scales to fit the screen.
export const DEFAULT_CANVAS_WIDTH = 1920;
export const DEFAULT_CANVAS_HEIGHT = 1080;

export type CanvasSegment = { kind: string; value: string };
export type CanvasBindingRow = { field: string; variable: string; segments?: CanvasSegment[] };

export interface UINode {
  entity: Entity;
  type: UINodeType;
  name: string;
  uiTransform?: unknown;
  uiBackground?: unknown;
  uiText?: unknown;
  uiInput?: unknown;
  uiDropdown?: unknown;
  bindings?: CanvasBindingRow[];
  // Only set on the root node — the per-UI design canvas size (px), sanitized
  // to a positive value with the DEFAULT_CANVAS_* fallback applied.
  canvasWidth?: number;
  canvasHeight?: number;
  children: UINode[];
}

interface ComponentBag {
  UiTransform: any;
  UiBackground: any;
  UiText: any;
  UiInput: any;
  UiDropdown: any;
  Name?: any;
  UIBindings?: any;
  UI?: any;
}

// Canonical SDK component IDs (verified against
// node_modules/@dcl/ecs/dist/components/generated/component-names.gen.js).
const COMPONENT_IDS = {
  UiTransform: 'core::UiTransform',
  UiBackground: 'core::UiBackground',
  UiText: 'core::UiText',
  UiInput: 'core::UiInput',
  UiDropdown: 'core::UiDropdown',
  Name: 'core-schema::Name',
} as const;

export function getComponentBag(engine: IEngine): ComponentBag {
  return {
    UiTransform: engine.getComponentOrNull(COMPONENT_IDS.UiTransform),
    UiBackground: engine.getComponentOrNull(COMPONENT_IDS.UiBackground),
    UiText: engine.getComponentOrNull(COMPONENT_IDS.UiText),
    UiInput: engine.getComponentOrNull(COMPONENT_IDS.UiInput),
    UiDropdown: engine.getComponentOrNull(COMPONENT_IDS.UiDropdown),
    Name: engine.getComponentOrNull(COMPONENT_IDS.Name),
    UIBindings: engine.getComponentOrNull(ComponentName.UI_BINDINGS),
    UI: engine.getComponentOrNull(ComponentName.UI),
  };
}

// Compose the canvas preview for a (possibly bound) text field. Mixed-content
// rows render literal text + `[variableName]` placeholders; a whole-field
// binding renders `[variableName]`; otherwise the static PB value is shown. The
// inspector has no runtime context, so bound segments preview as the variable
// name rather than a resolved value.
export function previewBoundText(
  bindings: CanvasBindingRow[] | undefined,
  fieldKey: string,
  staticValue: string,
): string {
  const row = bindings?.find(b => b.field === fieldKey);
  if (!row) return staticValue;
  if (row.segments && row.segments.length > 0) {
    return row.segments
      .map(s => (s.kind === SegmentKind.BINDING ? `[${s.value}]` : s.value))
      .join('');
  }
  if (row.variable) return `[${row.variable}]`;
  return staticValue;
}

export function classifyNode(bag: ComponentBag, entity: Entity): UINodeType {
  if (bag.UiInput?.has(entity)) return 'Input';
  if (bag.UiDropdown?.has(entity)) return 'Dropdown';
  if (bag.UiText?.has(entity)) return 'Label';
  // Buttons are heuristic: a UiEntity with a pointer-events listener.
  // In the absence of a pointer-events component, fall back to UiEntity.
  return 'UiEntity';
}

export function buildUINodeTree(engine: IEngine, rootEntity: Entity): UINode | null {
  const bag = getComponentBag(engine);
  if (!bag.UiTransform || !bag.UiTransform.has(rootEntity)) return null;

  // Collect every entity whose UiTransform.parent points at someone we've visited,
  // starting from rootEntity. Single pass over the UiTransform iterator suffices.
  const childrenOf = new Map<Entity, Entity[]>();
  for (const [entity, value] of bag.UiTransform.iterator() as Iterable<[Entity, any]>) {
    const parent: Entity | undefined = value?.parent;
    if (parent === undefined) continue;
    const list = childrenOf.get(parent) ?? [];
    list.push(entity);
    childrenOf.set(parent, list);
  }

  const visited = new Set<Entity>();
  function visit(entity: Entity): UINode {
    if (visited.has(entity)) {
      // Defensive — should not happen for a well-formed scene.
      return {
        entity,
        type: 'UiEntity',
        name: `Entity ${entity}`,
        children: [],
      };
    }
    visited.add(entity);
    const type = classifyNode(bag, entity);
    const name = bag.Name?.getOrNull(entity)?.value ?? `Entity ${entity}`;
    const node: UINode = {
      entity,
      type,
      name,
      uiTransform: bag.UiTransform.getOrNull(entity) ?? undefined,
      uiBackground: bag.UiBackground?.getOrNull(entity) ?? undefined,
      uiText: bag.UiText?.getOrNull(entity) ?? undefined,
      uiInput: bag.UiInput?.getOrNull(entity) ?? undefined,
      uiDropdown: bag.UiDropdown?.getOrNull(entity) ?? undefined,
      bindings: bag.UIBindings?.getOrNull(entity)?.value as CanvasBindingRow[] | undefined,
      children: (childrenOf.get(entity) ?? []).map(visit),
    };
    return node;
  }

  const root = visit(rootEntity);
  // The design canvas size lives on the root's `asset-packs::UI` marker. Sanitize
  // to a positive number, falling back to the default for new/legacy roots.
  const ui = bag.UI?.getOrNull(rootEntity);
  root.canvasWidth = ui?.canvasWidth > 0 ? ui.canvasWidth : DEFAULT_CANVAS_WIDTH;
  root.canvasHeight = ui?.canvasHeight > 0 ? ui.canvasHeight : DEFAULT_CANVAS_HEIGHT;
  return root;
}
