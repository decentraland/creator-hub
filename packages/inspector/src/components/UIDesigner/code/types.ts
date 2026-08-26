import type { DeviceKind } from '../shared/safe-areas';
import type { UINode } from '../shared/tree-model';
import type { InteractionStateKey } from './interaction-convention';

// Byte span [start, end) into the source text of the backing AST node.
export type Span = [number, number];

// One interaction layer's styles, in the same PB shape the panel and canvas read
// off a node — so a layer can be previewed and edited with the existing field
// editors rather than a parallel set.
export interface InteractionStateStyles {
  uiTransform?: Record<string, unknown>;
  uiBackground?: Record<string, unknown>;
  uiText?: Record<string, unknown>;
  uiInput?: Record<string, unknown>;
  uiDropdown?: Record<string, unknown>;
}

// A node whose styles are layered by interaction state (see
// interaction-convention.ts). `base` is the resting style the node renders with;
// the other layers override it while hovered / pressed / active.
export interface CodeInteraction {
  // Only layers actually present in source appear here.
  states: Partial<Record<InteractionStateKey, InteractionStateStyles>>;
  // Source text of the expression driving the `active` layer, when present
  // (e.g. `state.selected`).
  activeExpr?: string;
  // Identifier the call is bound to (`const btn = useInteraction(…)`); absent
  // when the call is spread inline.
  name?: string;
}

// A UINode produced from parsed TSX (code-mode) rather than from live ECS
// components. It is a regular UINode (so the existing Canvas renders it
// unchanged) plus two code-mode extras:
//  - `span`: the source range of the backing JSXElement, so a visual edit can
//    splice exactly that region instead of reprinting the file.
//  - `opaque`: set when the editor cannot faithfully represent the node
//    (loops, conditionals, custom components, spread props). Opaque nodes
//    render read-only on the canvas and are editable only in the code view;
//    their verbatim source is preserved.
export interface CodeUINode extends UINode {
  span: Span;
  /**
   * The node's user-facing name, from its `@ui-name` marker (see name-marker.ts).
   * Distinct from `name`, which is the JSX tag. Absent until the node is named.
   */
  uiName?: string;
  opaque?: { reason: string; raw: string };
  // Set when this node is a reference to ANOTHER editor root used as a component
  // (`<OtroNOmbre />`). Unlike an opaque node it is first-class (selectable,
  // movable, removable). `props` are the values set on THIS instance (parsed from
  // its JSX attributes); the referenced root's parsed tree (for the read-only
  // inline preview) is resolved separately into the store's `componentTrees`.
  componentRef?: { name: string; props: ComponentRefProp[] };
  // <Button>'s own two props (`variant` / `disabled`, keyed under `ui::button`).
  // Deliberately NOT part of InteractionStateStyles: they are plain JSX attributes
  // in every state (see parse-adapter's isLayerableComponent).
  uiButton?: Record<string, unknown>;
  // Set when some prop value could not be statically evaluated (e.g. a
  // variable/call reference). The node is still shown, but the editor does not
  // own those props — it must not clobber them on write.
  dynamicProps?: boolean;
  // Set when this node's styles come from a recognized `useInteraction(…)` call
  // spread onto it. The node's own uiTransform/uiBackground/uiText are hydrated
  // from the `base` layer, so everything downstream renders it unchanged.
  interaction?: CodeInteraction;
  // Set on the pass-through node for a recognized platform conditional
  // (`platform === 'mobile' ? <A /> : <B />`, see platform-convention.ts). Its
  // children are the authored branches, each tagged with `platform`; the canvas
  // renders only the active one. Not opaque — both branches stay editable.
  platformVariant?: true;
  // Set on a platform variant's branch: which platform renders this subtree.
  platform?: DeviceKind;
  children: CodeUINode[];
}

// A prop value set on a component-ref INSTANCE (`<Card title="Hi" active={on} />`):
// a static literal (`value`) or a bound expression's source text (`expr`).
export interface ComponentRefProp {
  name: string;
  value?: string | number | boolean;
  expr?: string;
}

export interface ParsedUI {
  // The component's returned root JSX element, mapped to a node tree.
  root: CodeUINode;
  // Synthetic node id (UINode.entity) → source span, for the emit/splice path.
  spans: Map<number, Span>;
  // Synthetic node id → backing AST node (a JSXElement / expression container).
  // The emit adapter uses this to locate exact attribute / object-property
  // spans on demand. Typed `unknown` to keep AST types internal to the module.
  astNodes: Map<number, unknown>;
  // True when at least one node in the tree is opaque — useful for surfacing a
  // "this UI contains code the editor can't fully edit" hint.
  hasOpaque: boolean;
}
