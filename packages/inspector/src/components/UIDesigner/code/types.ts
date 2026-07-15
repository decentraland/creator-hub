import type { UINode } from '../tree-model';

// Byte span [start, end) into the source text of the backing AST node.
export type Span = [number, number];

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
  opaque?: { reason: string; raw: string };
  // Set when this node is a reference to ANOTHER editor root used as a component
  // (`<OtroNOmbre />`). Unlike an opaque node it is first-class (selectable,
  // movable, removable). `props` are the values set on THIS instance (parsed from
  // its JSX attributes); the referenced root's parsed tree (for the read-only
  // inline preview) is resolved separately into the store's `componentTrees`.
  componentRef?: { name: string; props: ComponentRefProp[] };
  // Set when some prop value could not be statically evaluated (e.g. a
  // variable/call reference). The node is still shown, but the editor does not
  // own those props — it must not clobber them on write.
  dynamicProps?: boolean;
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
