import type { DeviceKind } from '../shared/safe-areas';
import type { UINode } from '../shared/tree-model';
import type { InteractionStateKey } from './interaction-convention';

/** Byte span [start, end) into the source text of the backing AST node. */
export type Span = [number, number];

/** One interaction layer's styles, in the same PB shape the panel and canvas read off a node. */
export interface InteractionStateStyles {
  uiTransform?: Record<string, unknown>;
  uiBackground?: Record<string, unknown>;
  uiText?: Record<string, unknown>;
  uiInput?: Record<string, unknown>;
  uiDropdown?: Record<string, unknown>;
}

/** A node whose styles are layered by interaction state (see interaction-convention.ts). */
export interface CodeInteraction {
  states: Partial<Record<InteractionStateKey, InteractionStateStyles>>;
  activeExpr?: string;
  name?: string;
}

/** A UINode produced from parsed TSX (code-mode) rather than from live ECS components. */
export interface CodeUINode extends UINode {
  span: Span;
  uiName?: string;
  opaque?: { reason: string; raw: string };
  componentRef?: { name: string; props: ComponentRefProp[] };
  uiButton?: Record<string, unknown>;
  dynamicProps?: boolean;
  interaction?: CodeInteraction;
  platformVariant?: true;
  platform?: DeviceKind;
  children: CodeUINode[];
}

/** A prop value set on a component-ref instance: a static literal (`value`) or a bound expression's source text (`expr`). */
export interface ComponentRefProp {
  name: string;
  value?: string | number | boolean;
  expr?: string;
}

export interface ParsedUI {
  root: CodeUINode;
  spans: Map<number, Span>;
  astNodes: Map<number, unknown>;
  hasOpaque: boolean;
}
