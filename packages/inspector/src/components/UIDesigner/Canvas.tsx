import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDrop } from 'react-dnd';
import {
  IoAddOutline,
  IoCopyOutline,
  IoDesktopOutline,
  IoLayersOutline,
  IoPhoneLandscapeOutline,
  IoScanOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import cx from 'classnames';
import type { Entity, PBUiTransform } from '@dcl/ecs';

import { useAssetUrl } from '../../hooks/useAssetUrl';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import {
  getAspectLockedNodes,
  getHiddenNodes,
  getInteractionLayer,
  getLockedNodes,
  getPlatform,
  getSelectedNode,
  getSelectedNodes,
  selectNode,
  setPlatform,
  toggleNodeSelection,
} from '../../redux/ui-designer';
import { Button } from '../Button';
import {
  YGU_UNDEFINED,
  YGU_POINT,
  YGU_PERCENT,
  YGU_AUTO,
  YGD_NONE,
  YGPT_RELATIVE,
  YGPT_ABSOLUTE,
} from '../../lib/sdk/ui-transform-constants';
import { UI_DESIGNER_DND_TYPE, type UIDesignerDragItem } from './Palette';
import { EmptyState } from './EmptyState';
import { WidgetPicker } from './WidgetPicker';
import { SafeAreaOverlay } from './SafeAreaOverlay';
import { MOBILE_REFERENCE } from './safe-areas';
import { dragPinHold } from './align-presets';
import { DEFAULT_CANVAS_SCALE, getCanvasScale, offsetInParent, setCanvasScale } from './measure';
import { flowFrom, insertionSlot } from './reorder';
import type { Box, Flow, InsertionSlot } from './reorder';
import { useUINodeActions } from './useUINodeActions';
import { useUINodeTree } from './useUINodeTree';
import {
  createRoot as createCodeRoot,
  spliceAddChild,
  spliceInsertComponent,
  spliceMove,
  spliceSetRootChild,
  spliceUiTransformPosition,
  spliceUiTransformResize,
  useCodeState,
} from './code/store';
import type { MoveAnchor } from './code/store';
import { buildResolveMap } from './code/bindings';
import { previewLayers, resolveInteractionPreview } from './code/interaction-preview';
import type { CodeUINode } from './code/types';
import { MixedContentField } from './MixedContentField';
import { seedSegments } from './MixedContentField/segments';
import type { FieldConfig } from './field-configs';
import {
  clearNodeRegistry,
  getNodeElement,
  registerNodeElement,
  unregisterNodeElement,
} from './node-registry';
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  previewBoundText,
  type UINode,
  type UINodeType,
} from './tree-model';

// The canvas size (canvasWidth × canvasHeight on the parsed root node, default
// 1920×1080) is the UI's design/virtual resolution, scaled to fit the player's
// screen at runtime. On top of that sits the EDITOR zoom (the user can zoom; see
// CanvasComponent), which measure.ts owns as the live viewport↔logical px factor.
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;
const clampZoom = (s: number): number =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(s * 100) / 100));

// Snap grid for drag-to-move when Shift is NOT held. Held → free movement.
// 10 logical px = 4 viewport px at the current scale — fine enough for
// fluid drags, coarse enough to keep things aligned.
const DRAG_SNAP_GRID = 10;

// 8 directional resize handles. The axis vector for each handle controls
// which of {position-x, position-y, width, height} the delta affects.
type HandleDir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
const HANDLE_AXES: Record<
  HandleDir,
  { dx: -1 | 0 | 1; dy: -1 | 0 | 1; dw: -1 | 0 | 1; dh: -1 | 0 | 1 }
> = {
  nw: { dx: 1, dy: 1, dw: -1, dh: -1 },
  n: { dx: 0, dy: 1, dw: 0, dh: -1 },
  ne: { dx: 0, dy: 1, dw: 1, dh: -1 },
  e: { dx: 0, dy: 0, dw: 1, dh: 0 },
  se: { dx: 0, dy: 0, dw: 1, dh: 1 },
  s: { dx: 0, dy: 0, dw: 0, dh: 1 },
  sw: { dx: 1, dy: 0, dw: -1, dh: 1 },
  w: { dx: 1, dy: 0, dw: -1, dh: 0 },
};
const HANDLE_DIRS: HandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

import './Canvas.css';

// Resolves a binding expression (`state.name`) to its default value for the
// canvas text preview (so `value={state.name}` with default 'John' renders
// "John", not "[state.name]"). Built once at the Canvas root from the binding
// surface and read by each CanvasNode; default returns undefined (→ placeholder).
const VarPreviewContext = React.createContext<(expr: string) => string | undefined>(
  () => undefined,
);

// BackgroundTextureMode (PB) — NINE_SLICES=0, CENTER=1, STRETCH=2. This PB enum
// is exported as a `const enum` (erased at compile time), so its numeric value
// is hard-coded here with a comment — same convention as the UiTransform enums
// centralized in ../../lib/sdk/ui-transform-constants. See
// node_modules/@dcl/ecs/dist/components/generated/pb/decentraland/sdk/components/ui_background.gen.d.ts
// Only CENTER needs distinct handling; STRETCH and NINE_SLICES (approximated)
// both map to a full-box stretch.
const BTM_CENTER = 1;

const FLEX_DIRECTION: Record<number, React.CSSProperties['flexDirection']> = {
  0: 'row',
  1: 'column',
  2: 'column-reverse',
  3: 'row-reverse',
};

const JUSTIFY_CONTENT: Record<number, React.CSSProperties['justifyContent']> = {
  0: 'flex-start',
  1: 'center',
  2: 'flex-end',
  3: 'space-between',
  4: 'space-around',
  5: 'space-evenly',
};

// YGWrap. Yoga and CSS agree on `nowrap` as the default, so an unset value needs
// no explicit write (unlike flexShrink below).
const FLEX_WRAP: Record<number, React.CSSProperties['flexWrap']> = {
  0: 'nowrap',
  1: 'wrap',
  2: 'wrap-reverse',
};

// YGAlign — used for alignItems / alignSelf / alignContent. CSS doesn't have
// a one-to-one mapping for `baseline` on alignContent, but the common values
// (auto/flex-start/center/flex-end/stretch/space-between/space-around) line up.
const ALIGN: Record<number, string> = {
  0: 'auto',
  1: 'flex-start',
  2: 'center',
  3: 'flex-end',
  4: 'stretch',
  5: 'baseline',
  6: 'space-between',
  7: 'space-around',
};

const OVERFLOW: Record<number, React.CSSProperties['overflow']> = {
  0: 'visible',
  1: 'hidden',
  2: 'scroll',
};

// TextAlignMode (PB) → CSS text-align. PB combines vertical+horizontal in a
// single 9-value enum; CSS text-align is horizontal only, so this covers the
// horizontal axis of multi-line wrapping inside the text span. The box-level
// anchoring (both axes) is done with flexbox via TEXT_ALIGN_FLEX below.
// A Button carries `uiText` exactly like a Label — react-ecs's Button reuses
// Label's getTextAlign/getFont/getFontSize and writes the result into uiText —
// so every text path has to treat the two alike. Forgetting Button is what left
// its label stuck top-left (no flex anchoring) and blank inside a nested
// component (no text span at all).
const rendersText = (type: UINodeType): boolean => type === 'Label' || type === 'Button';

const TEXT_ALIGN_H: Record<number, React.CSSProperties['textAlign']> = {
  0: 'left', // TOP_LEFT
  1: 'center', // TOP_CENTER
  2: 'right', // TOP_RIGHT
  3: 'left', // MIDDLE_LEFT
  4: 'center', // MIDDLE_CENTER
  5: 'right', // MIDDLE_RIGHT
  6: 'left', // BOTTOM_LEFT
  7: 'center', // BOTTOM_CENTER
  8: 'right', // BOTTOM_RIGHT
};

// TextAlignMode (PB, row-major: top/middle/bottom × left/center/right) → the
// flex justify/align pair that anchors a Label's text span in its box, so the
// canvas reproduces react-ecs's 2D text placement (not just the horizontal
// axis). flexDirection stays 'row', so justifyContent is the horizontal axis and
// alignItems the vertical one. PB default is TAM_TOP_LEFT (0) — react-ecs adds no
// default of its own, so an unset textAlign anchors top-left in-world.
const TEXT_ALIGN_FLEX: Record<
  number,
  {
    justifyContent: React.CSSProperties['justifyContent'];
    alignItems: React.CSSProperties['alignItems'];
  }
> = {
  0: { justifyContent: 'flex-start', alignItems: 'flex-start' },
  1: { justifyContent: 'center', alignItems: 'flex-start' },
  2: { justifyContent: 'flex-end', alignItems: 'flex-start' },
  3: { justifyContent: 'flex-start', alignItems: 'center' },
  4: { justifyContent: 'center', alignItems: 'center' },
  5: { justifyContent: 'flex-end', alignItems: 'center' },
  6: { justifyContent: 'flex-start', alignItems: 'flex-end' },
  7: { justifyContent: 'center', alignItems: 'flex-end' },
  8: { justifyContent: 'flex-end', alignItems: 'flex-end' },
};

// Font (PB) → CSS font-family, for a faithful preview of the Label `font` prop.
const FONT_FAMILY: Record<number, string> = {
  0: 'sans-serif',
  1: 'serif',
  2: 'monospace',
};

function cssLen(value: number | undefined, unit: number | undefined): string | undefined {
  if (value === undefined || unit === undefined) return undefined;
  if (unit === YGU_UNDEFINED) return undefined;
  if (unit === YGU_AUTO) return 'auto';
  if (unit === YGU_PERCENT) return `${value}%`;
  if (unit === YGU_POINT) return `${value}px`;
  return undefined;
}

function color4ToRgba(c: { r: number; g: number; b: number; a?: number }): string {
  const a = c.a ?? 1;
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;
}

// react-ecs writes no border color when a width is set but no color is given; the
// in-world renderer and the property panel both treat that default as opaque
// black. Match it so the canvas preview doesn't fall back to `currentColor` (the
// node's light text color), which read as a mismatch against the panel swatch.
const DEFAULT_BORDER_COLOR = { r: 0, g: 0, b: 0, a: 1 };

// The Label/Button text field, driving the inline mixed-content editor (literal
// text + variable/prop bindings). Same UiText.value field the panel binds.
const TEXT_VALUE_FIELD: FieldConfig = {
  label: 'Text',
  componentId: 'core::UiText',
  path: 'value',
  kind: 'string',
  mixable: true,
};

function nodeStyle(node: UINode): React.CSSProperties {
  const t = (node.uiTransform ?? {}) as Record<string, number | undefined>;
  const b = (node.uiBackground ?? {}) as {
    color?: { r: number; g: number; b: number; a?: number };
  };
  const text = (node.uiText ?? {}) as {
    color?: { r: number; g: number; b: number; a?: number };
    fontSize?: number;
    textAlign?: number;
    font?: number;
  };

  // The DCL react-ecs runtime seeds a default UiTransform, so apply those same
  // defaults up-front for a faithful preview when a prop is unset:
  //   - flexDirection: react-ecs defaults to ROW (its UiEntity overrides Yoga's
  //     COLUMN default; @dcl/react-ecs uiTransform defaultUiTransform). This also
  //     matches CSS flexbox's row default.
  //   - flexShrink:    Yoga/react-ecs default 0; CSS defaults 1 — set explicitly.
  const style: React.CSSProperties = {
    display: t.display === YGD_NONE ? 'none' : 'flex',
    position: t.positionType === YGPT_ABSOLUTE ? 'absolute' : 'relative',
    flexDirection: 'row',
    flexShrink: 0,
    boxSizing: 'border-box',
  };

  if (t.flexDirection !== undefined && FLEX_DIRECTION[t.flexDirection]) {
    style.flexDirection = FLEX_DIRECTION[t.flexDirection];
  }
  if (t.justifyContent !== undefined && JUSTIFY_CONTENT[t.justifyContent]) {
    style.justifyContent = JUSTIFY_CONTENT[t.justifyContent];
  }
  if (t.flexWrap !== undefined && FLEX_WRAP[t.flexWrap]) {
    style.flexWrap = FLEX_WRAP[t.flexWrap];
  }
  if (t.alignItems !== undefined && ALIGN[t.alignItems]) {
    style.alignItems = ALIGN[t.alignItems] as React.CSSProperties['alignItems'];
  }
  if (t.alignSelf !== undefined && ALIGN[t.alignSelf]) {
    style.alignSelf = ALIGN[t.alignSelf] as React.CSSProperties['alignSelf'];
  }
  if (t.alignContent !== undefined && ALIGN[t.alignContent]) {
    style.alignContent = ALIGN[t.alignContent] as React.CSSProperties['alignContent'];
  }
  if (t.overflow !== undefined && OVERFLOW[t.overflow]) {
    style.overflow = OVERFLOW[t.overflow];
  }

  if (t.flexGrow !== undefined) style.flexGrow = t.flexGrow;
  if (t.flexShrink !== undefined) style.flexShrink = t.flexShrink;

  const flexBasis = cssLen(t.flexBasis, t.flexBasisUnit);
  if (flexBasis !== undefined) style.flexBasis = flexBasis;

  const width = cssLen(t.width, t.widthUnit);
  if (width !== undefined) style.width = width;
  const height = cssLen(t.height, t.heightUnit);
  if (height !== undefined) style.height = height;
  const minWidth = cssLen(t.minWidth, t.minWidthUnit);
  if (minWidth !== undefined) style.minWidth = minWidth;
  const maxWidth = cssLen(t.maxWidth, t.maxWidthUnit);
  if (maxWidth !== undefined) style.maxWidth = maxWidth;
  const minHeight = cssLen(t.minHeight, t.minHeightUnit);
  if (minHeight !== undefined) style.minHeight = minHeight;
  const maxHeight = cssLen(t.maxHeight, t.maxHeightUnit);
  if (maxHeight !== undefined) style.maxHeight = maxHeight;

  const paddingTop = cssLen(t.paddingTop, t.paddingTopUnit);
  if (paddingTop !== undefined) style.paddingTop = paddingTop;
  const paddingRight = cssLen(t.paddingRight, t.paddingRightUnit);
  if (paddingRight !== undefined) style.paddingRight = paddingRight;
  const paddingBottom = cssLen(t.paddingBottom, t.paddingBottomUnit);
  if (paddingBottom !== undefined) style.paddingBottom = paddingBottom;
  const paddingLeft = cssLen(t.paddingLeft, t.paddingLeftUnit);
  if (paddingLeft !== undefined) style.paddingLeft = paddingLeft;

  const marginTop = cssLen(t.marginTop, t.marginTopUnit);
  if (marginTop !== undefined) style.marginTop = marginTop;
  const marginRight = cssLen(t.marginRight, t.marginRightUnit);
  if (marginRight !== undefined) style.marginRight = marginRight;
  const marginBottom = cssLen(t.marginBottom, t.marginBottomUnit);
  if (marginBottom !== undefined) style.marginBottom = marginBottom;
  const marginLeft = cssLen(t.marginLeft, t.marginLeftUnit);
  if (marginLeft !== undefined) style.marginLeft = marginLeft;

  const top = cssLen(t.positionTop, t.positionTopUnit);
  if (top !== undefined) style.top = top;
  const right = cssLen(t.positionRight, t.positionRightUnit);
  if (right !== undefined) style.right = right;
  const bottom = cssLen(t.positionBottom, t.positionBottomUnit);
  if (bottom !== undefined) style.bottom = bottom;
  const left = cssLen(t.positionLeft, t.positionLeftUnit);
  if (left !== undefined) style.left = left;

  if (t.opacity !== undefined) style.opacity = t.opacity;
  if (t.zIndex !== undefined) style.zIndex = t.zIndex;

  // Border radius — CSS `border-radius` shorthand is TL TR BR BL.
  const rTL = cssLen(t.borderTopLeftRadius, t.borderTopLeftRadiusUnit);
  const rTR = cssLen(t.borderTopRightRadius, t.borderTopRightRadiusUnit);
  const rBR = cssLen(t.borderBottomRightRadius, t.borderBottomRightRadiusUnit);
  const rBL = cssLen(t.borderBottomLeftRadius, t.borderBottomLeftRadiusUnit);
  if (rTL ?? rTR ?? rBR ?? rBL) {
    style.borderRadius = `${rTL ?? 0} ${rTR ?? 0} ${rBR ?? 0} ${rBL ?? 0}`;
  }

  // Border width + color, per side.
  const applyBorder = (
    side: 'Top' | 'Right' | 'Bottom' | 'Left',
    widthKey: keyof typeof t,
    unitKey: keyof typeof t,
    color: { r: number; g: number; b: number; a?: number } | undefined,
  ) => {
    const w = cssLen(t[widthKey], t[unitKey]);
    if (w !== undefined) {
      (style as Record<string, unknown>)[`border${side}Width`] = w;
      (style as Record<string, unknown>)[`border${side}Style`] = 'solid';
      (style as Record<string, unknown>)[`border${side}Color`] = color4ToRgba(
        color ?? DEFAULT_BORDER_COLOR,
      );
    }
  };
  // Border colors are color objects, not the numbers `t` is typed as; read
  // them off the same object through a widened view.
  const tc = t as Record<string, any>;
  applyBorder('Top', 'borderTopWidth', 'borderTopWidthUnit', tc.borderTopColor);
  applyBorder('Right', 'borderRightWidth', 'borderRightWidthUnit', tc.borderRightColor);
  applyBorder('Bottom', 'borderBottomWidth', 'borderBottomWidthUnit', tc.borderBottomColor);
  applyBorder('Left', 'borderLeftWidth', 'borderLeftWidthUnit', tc.borderLeftColor);

  if (b?.color) {
    style.backgroundColor = color4ToRgba(b.color);
  }
  if (text?.color) {
    style.color = color4ToRgba(text.color);
  }
  if (text?.fontSize !== undefined) {
    style.fontSize = `${text.fontSize}px`;
  }
  // Label/Button text: anchor the text span in its box exactly as react-ecs
  // does. The textAlign enum drives BOTH axes via flexbox (justify = horizontal,
  // align = vertical), overriding the generic container justify/align — the only
  // "child" here is the text. CSS text-align alone cannot do this: the span is a
  // flex ITEM, so its position comes from justify-content, not text-align. An
  // unset textAlign anchors middle-center (4): the in-world default per @dcl/ecs
  // PBUiText ("alignment within the bounds (default: center)"), NOT the proto-3
  // zero (top-left).
  if (rendersText(node.type)) {
    const ta = typeof text.textAlign === 'number' ? text.textAlign : 4;
    const flex = TEXT_ALIGN_FLEX[ta] ?? TEXT_ALIGN_FLEX[4];
    style.justifyContent = flex.justifyContent;
    style.alignItems = flex.alignItems;
    style.textAlign = TEXT_ALIGN_H[ta] ?? 'center';
    if (text.font !== undefined && FONT_FAMILY[text.font]) {
      style.fontFamily = FONT_FAMILY[text.font];
    }
  } else if (text?.textAlign !== undefined && TEXT_ALIGN_H[text.textAlign]) {
    style.textAlign = TEXT_ALIGN_H[text.textAlign];
  }
  return style;
}

// The resolved URL is interpolated into a CSS `url("...")` context. A value
// containing a quote/paren/whitespace/backslash could break out of that
// context, so we gate emission on a strict allowlist (output-sink hardening,
// independent of the TextureField commit-path validation). blob: is the normal
// asset-path case; http/https covers acceptURLs; data:image/ is harmless for
// images. Anything else (or an unsafe character) drops the image entirely and
// the background color still shows.
function safeTextureUrl(url: string): string | undefined {
  if (/["'()\\\s]/.test(url)) return undefined;
  if (!/^(blob:|https?:|data:image\/)/.test(url)) return undefined;
  return url;
}

// Map a resolved file-texture blob URL + PB textureMode to CSS background-*.
// Layered on top of nodeStyle so the background COLOR remains a fallback while
// the image is still loading. NINE_SLICES has no clean CSS equivalent here;
// we approximate it with a full stretch (border-image slicing would need the
// per-side slice values and is out of scope for the preview).
function textureStyle(
  url: string,
  textureMode: number | undefined,
  uvs: number[] | undefined,
): React.CSSProperties {
  const safe = safeTextureUrl(url);
  const base: React.CSSProperties = { backgroundRepeat: 'no-repeat' };
  if (safe) base.backgroundImage = `url("${safe}")`;
  if (textureMode === BTM_CENTER) {
    return { ...base, backgroundSize: 'auto', backgroundPosition: 'center' };
  }
  // STRETCH with a sub-region: show that region scaled to fill the box. UV v is
  // bottom-up, CSS background-position y is top-down — hence (1 - vMax) below.
  // Approximate preview; runtime uses the raw uvs.
  if (textureMode === 2 && uvs && uvs.length >= 8) {
    const us = [uvs[0], uvs[2], uvs[4], uvs[6]];
    const vs = [uvs[1], uvs[3], uvs[5], uvs[7]];
    const uMin = Math.min(...us);
    const uMax = Math.max(...us);
    const vMin = Math.min(...vs);
    const vMax = Math.max(...vs);
    const rw = uMax - uMin;
    const rh = vMax - vMin;
    if (rw > 0 && rh > 0 && (rw < 1 || rh < 1)) {
      const posX = rw < 1 ? (uMin / (1 - rw)) * 100 : 0;
      const posY = rh < 1 ? ((1 - vMax) / (1 - rh)) * 100 : 0;
      return {
        ...base,
        backgroundSize: `${(1 / rw) * 100}% ${(1 / rh) * 100}%`,
        backgroundPosition: `${posX}% ${posY}%`,
      };
    }
  }
  return { ...base, backgroundSize: '100% 100%' };
}

// A canvas drag of an IN-FLOW node, captured on mousedown: it reorders the node
// among its siblings rather than offsetting it. Boxes are viewport px read once —
// nothing reflows during the drag (the node moves by CSS transform), so re-reading
// them per mousemove would measure the same layout.
type ReorderDrag = {
  parentEl: HTMLElement;
  parentBox: Box;
  flow: Flow;
  // In-flow siblings excluding the dragged node, in DOM order (= source order).
  siblings: { entity: Entity; box: Box }[];
  // Center of the dragged node's own box — the point hit-tested against the
  // siblings, offset by the live drag delta. Grabbing a node near its edge must
  // not decide the drop.
  center: { x: number; y: number };
  // Slot equal to a no-op drop, and the live slot under the drag.
  selfIndex: number;
  slot: InsertionSlot;
};

const toBox = (r: DOMRect): Box => ({
  left: r.left,
  top: r.top,
  right: r.right,
  bottom: r.bottom,
});

// Snapshot the reorder context for `el` from the rendered DOM: the parent's flow
// comes from its computed style (the canvas renders UiTransform as real CSS, so
// the browser's layout IS what the user drops onto). Absolute siblings are out of
// flow, and zero-area ones (display: none) carry no box to hit-test against.
function captureReorderDrag(el: HTMLElement): ReorderDrag | null {
  const parentEl = el.parentElement;
  if (!parentEl) return null;
  const parentStyle = getComputedStyle(parentEl);
  const siblings: { entity: Entity; box: Box }[] = [];
  let selfIndex = 0;
  for (const child of Array.from(parentEl.children)) {
    if (child === el) {
      selfIndex = siblings.length;
      continue;
    }
    if (!(child instanceof HTMLElement) || !child.dataset.entity) continue;
    if (getComputedStyle(child).position === 'absolute') continue;
    const rect = child.getBoundingClientRect();
    if (!rect.width && !rect.height) continue;
    siblings.push({ entity: Number(child.dataset.entity) as unknown as Entity, box: toBox(rect) });
  }
  const self = el.getBoundingClientRect();
  const center = { x: self.left + self.width / 2, y: self.top + self.height / 2 };
  const parentBox = toBox(parentEl.getBoundingClientRect());
  const flow = flowFrom(parentStyle.flexDirection, parentStyle.flexWrap);
  return {
    parentEl,
    parentBox,
    flow,
    siblings,
    center,
    selfIndex,
    slot: insertionSlot(
      siblings.map(s => s.box),
      center,
      flow,
      parentBox,
    ),
  };
}

// Place the insertion-indicator line for a reorder drag. The slot is computed in
// viewport px against the same captured boxes, so it converts to the parent's
// local (logical) px — the portal target is the parent node, which lives inside
// the scaled canvas root.
function reorderIndicatorStyle(ro: ReorderDrag): React.CSSProperties {
  const scale = getCanvasScale();
  const { slot, parentBox, flow } = ro;
  const main = (slot.main - (flow.axis === 'x' ? parentBox.left : parentBox.top)) / scale - 1;
  const crossOrigin = flow.axis === 'x' ? parentBox.top : parentBox.left;
  const cross = (slot.crossStart - crossOrigin) / scale;
  const crossLength = (slot.crossEnd - slot.crossStart) / scale;
  return flow.axis === 'x'
    ? { position: 'absolute', left: main, top: cross, width: 2, height: crossLength }
    : { position: 'absolute', top: main, left: cross, height: 2, width: crossLength };
}

// `hidden` = editor-only canvas hide (tree eye button): render with
// `visibility: hidden` so the node keeps its layout box — siblings must NOT
// reflow — but paints nothing and takes no pointer events.
type CanvasNodeProps = { node: CodeUINode; hidden?: boolean };

const hiddenStyle = (style: React.CSSProperties, hidden?: boolean): React.CSSProperties =>
  hidden ? { ...style, visibility: 'hidden' } : style;

// Floating Duplicate / Delete bar shown on the selected (non-root) node. Mounted
// only for the selected node, so `useUINodeActions` (and its tree subscription)
// isn't paid per-node. Counter-scaled via --uid-scale so it stays legible at any
// canvas zoom. Stops mouse events so clicking it never starts a node drag.
const CanvasNodeActions: React.FC<{ entity: Entity }> = ({ entity }) => {
  const { remove, duplicate } = useUINodeActions();
  const [addOpen, setAddOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  return (
    <div
      className="ui-designer-node-actions"
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <button
        ref={addBtnRef}
        type="button"
        className="ui-designer-node-action"
        aria-label="Add child"
        title="Add child"
        onClick={() => setAddOpen(true)}
      >
        <IoAddOutline aria-hidden="true" />
      </button>
      <button
        type="button"
        className="ui-designer-node-action"
        aria-label="Duplicate node"
        title="Duplicate"
        onClick={() => void duplicate(entity)}
      >
        <IoCopyOutline aria-hidden="true" />
      </button>
      <button
        type="button"
        className="ui-designer-node-action"
        aria-label="Delete node"
        title="Delete"
        onClick={() => remove(entity)}
      >
        <IoTrashOutline aria-hidden="true" />
      </button>
      {addOpen ? (
        <WidgetPicker
          parent={entity}
          anchorRef={addBtnRef}
          onDismiss={() => setAddOpen(false)}
        />
      ) : null}
    </div>
  );
};

const CanvasNode: React.FC<CanvasNodeProps> = ({ node, hidden }) => {
  const dispatch = useAppDispatch();
  // Subscribe to a derived boolean rather than the raw selection: selecting a
  // node is a Redux action that does NOT rebuild the node tree, so a raw
  // selection subscription would re-render every CanvasNode on each click.
  // react-redux only re-renders when the selector OUTPUT changes, so this
  // confines the re-render to the nodes whose membership actually flips.
  const isSelected = useAppSelector(state => getSelectedNodes(state).includes(node.entity));
  // Editor-only canvas lock (tree lock button): the node still renders but
  // takes no select/drag/resize. Derived boolean for the same re-render
  // reasons as isSelected.
  const isLocked = useAppSelector(
    state => !!getLockedNodes(state)[node.entity as unknown as number],
  );
  // Aspect-ratio lock (Size row toggle). Held in a ref too, so the window resize
  // handler reads the latest value without re-subscribing its effect.
  const aspectLocked = useAppSelector(
    state => !!getAspectLockedNodes(state)[node.entity as unknown as number],
  );
  const aspectLockedRef = useRef(aspectLocked);
  useEffect(() => {
    aspectLockedRef.current = aspectLocked;
  }, [aspectLocked]);

  // Interaction-state preview. Two sources: pointing at the node on the canvas
  // previews its Hover layer, and the layer the properties panel is editing is
  // previewed on the SELECTED node (so opening "Pressed" shows the pressed look
  // without needing to hold the mouse — which would collide with drag-to-move).
  const [canvasHovered, setCanvasHovered] = useState(false);
  const panelLayer = useAppSelector(getInteractionLayer);
  // Only the STYLE is resolved through the preview — never the node the drag /
  // resize math reads. Those write the `base` layer, so deriving their numbers
  // from a previewed override (a narrower `press` width, say) would bake the
  // override's geometry into Default on the next drag.
  const previewNode = useMemo(
    () =>
      resolveInteractionPreview(
        node,
        previewLayers({
          layer: isSelected ? panelLayer : undefined,
          hovered: canvasHovered,
        }),
      ),
    [node, isSelected, panelLayer, canvasHovered],
  );

  const text = (previewNode.uiText ?? {}) as { value?: string };
  const input = (previewNode.uiInput ?? {}) as { placeholder?: string; value?: string };
  const dropdown = (previewNode.uiDropdown ?? {}) as {
    options?: string[];
    selectedIndex?: number;
    emptyLabel?: string;
  };

  // Preview bound/mixed text: a bound field composes from its binding row
  // (single expr or template segments), resolving each variable to its default
  // value (`state.name` → "John") via the Canvas-root resolver.
  const resolveVar = useContext(VarPreviewContext);
  const labelText = previewBoundText(
    node.bindings,
    'core::UiText.value',
    text.value ?? '',
    resolveVar,
  );
  const inputText =
    previewBoundText(node.bindings, 'core::UiInput.value', input.value ?? '', resolveVar) ||
    previewBoundText(
      node.bindings,
      'core::UiInput.placeholder',
      input.placeholder ?? '',
      resolveVar,
    ) ||
    'Input';

  // Only the FILE texture variant is previewable as a CSS background-image.
  // Avatar/video textures resolve to no preview (color/layout still renders).
  const background = (previewNode.uiBackground ?? {}) as {
    texture?: { tex?: { $case: string; texture?: { src?: string } } };
    textureMode?: number;
    uvs?: number[];
  };
  const tex = background.texture?.tex;
  const texSrc = tex?.$case === 'texture' ? tex.texture?.src : undefined;
  const texUrl = useAssetUrl(texSrc);

  // Ref to the rendered div so we can translate viewport drop coords into
  // logical (Yoga) coords inside this node.
  const divRef = useRef<HTMLDivElement | null>(null);

  // --- Drop target (palette → place new node) ---
  // Reparenting via canvas drag was removed; reparent lives in the tree view
  // only (matches Unity / Unreal / Godot — viewport drag = reposition, tree
  // drag = reparent). The drop target still exists for palette placement.
  const [{ isOver }, drop] = useDrop<UIDesignerDragItem, unknown, { isOver: boolean }>(
    () => ({
      accept: UI_DESIGNER_DND_TYPE,
      collect: monitor => ({ isOver: monitor.isOver({ shallow: true }) }),
      drop: async (item, monitor) => {
        if (monitor.didDrop()) return;
        // Add the child by splicing a new element into the parent's source
        // (drop position not honored yet — appended as a child).
        if (item.source === 'palette') {
          void spliceAddChild(
            node.entity as unknown as number,
            item.type as UINodeType,
            item.preset,
          );
        } else if (item.source === 'component') {
          // Nest another root as a component (guarded against reference cycles).
          void spliceInsertComponent(node.entity as unknown as number, item.name);
        }
      },
    }),
    [node.entity],
  );

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      divRef.current = el;
      drop(el);
      if (el) {
        registerNodeElement(node.entity, el);
      } else {
        unregisterNodeElement(node.entity);
      }
    },
    [drop, node.entity],
  );

  // --- Native drag-to-move (Unity/Unreal/Godot style) ---
  // We bypass react-dnd here because we want live, continuous movement with
  // CSS transforms (no per-tick CRDT writes). Listener installs only run
  // while a drag is in flight.
  const t = (node.uiTransform ?? null) as PBUiTransform | null;
  // The root is the only entity in the tree whose UiTransform.parent is 0.
  // We don't let the root be dragged. Any non-root node is draggable; if it's
  // currently flex-flow (positionType !== ABSOLUTE) we implicitly convert it
  // to absolute on the first drag and pin it at the position it was rendered
  // at — same as Unreal's Canvas Panel behaviour.
  const isRoot = !t?.parent;
  // Direct manipulation (Figma-style, no mode toggle): any non-root node is
  // draggable to move (unless locked), and its 8 resize handles appear whenever
  // it's selected. handleResizeStart stopPropagation keeps a border-handle drag
  // from also starting a body move.
  const canDragMove = !isRoot && !isLocked;
  const showResizeHandles = !isRoot && isSelected && !isLocked;

  const dragOriginRef = useRef<{
    mouseX: number;
    mouseY: number;
    startTop: number;
    startLeft: number;
  } | null>(null);
  const liveOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [isDragging, setIsDragging] = useState(false);
  // Force re-render during move without storing the offset in state directly
  // (state writes during pointermove would batch-cancel each other in React).
  const [, setRenderTick] = useState(0);
  // On release we hold the node at its dropped position/size until the committed
  // transform catches up — the engine write round-trips asynchronously, so
  // without this the node snaps back to its old box for a frame, then jumps.
  // Move sets top/left; resize also sets width/height.
  const [optimisticPos, setOptimisticPos] = useState<{
    top?: number;
    left?: number;
    width?: number;
    height?: number;
    marginTop?: number;
    marginLeft?: number;
  } | null>(null);

  // --- Reorder-drag state (in-flow nodes) ---
  const reorderRef = useRef<ReorderDrag | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  // A reorder changes the node's PATH, not its offsets, so optimisticPos can't
  // express the dropped state. Hold the drag translate instead: the node stays
  // under the cursor until the spliced source round-trips and the rebuilt tree
  // reflows it into its new slot — releasing on mouseup would snap it back to the
  // old slot for a frame. Released by the reparse (below) or by the splice
  // settling, which covers a drop the store rejects (no reparse follows one).
  const [heldOffset, setHeldOffset] = useState<{ dx: number; dy: number } | null>(null);

  // --- Resize-tool state ---
  const resizeOriginRef = useRef<{
    mouseX: number;
    mouseY: number;
    startTop: number;
    startLeft: number;
    startW: number;
    startH: number;
    dir: HandleDir;
    isAbsolute: boolean;
  } | null>(null);
  const resizeLiveRef = useRef<{ dx: number; dy: number; dw: number; dh: number }>({
    dx: 0,
    dy: 0,
    dw: 0,
    dh: 0,
  });
  const [isResizing, setIsResizing] = useState(false);

  // --- Inline canvas text editing (double-click a Label/Button) ---
  // Reuses the panel's MixedContentField, so the inline editor handles literal
  // text AND variable/prop bindings (type, or insert a chip via the picker) —
  // including editing an already-bound value. Editing ends on a click outside
  // the editor and its (portaled) picker, or on Escape.
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  editingRef.current = editing;
  const isTextEditable = !isLocked && rendersText(node.type);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isLocked) return; // locked: clicks fall through, node not selectable
      e.stopPropagation();
      // Modifier-click toggles membership in the multi-selection (#1400); the
      // canvas has no row order, so shift behaves like ctrl here.
      if (e.ctrlKey || e.metaKey || e.shiftKey)
        dispatch(toggleNodeSelection({ node: node.entity }));
      else dispatch(selectNode({ node: node.entity }));
    },
    [dispatch, node.entity, isLocked],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isTextEditable) return;
      e.stopPropagation();
      setEditing(true);
      dispatch(selectNode({ node: node.entity }));
    },
    [isTextEditable, dispatch, node.entity],
  );

  useEffect(() => {
    if (!editing) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.ui-designer-mixed-field') || t.closest('.ui-designer-variable-picker'))
        return;
      setEditing(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditing(false);
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [editing]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // left-drag moves; right/middle bubble to the canvas pan
      if (e.ctrlKey || e.metaKey || e.shiftKey) return; // modifier-click = selection toggle, not a drag
      if (isLocked) return;
      if (!canDragMove) return;
      if (editingRef.current) return; // don't drag while editing text inline
      // Ignore clicks inside inputs / interactive children so the property
      // panel doesn't end up dragging the parent node.
      const target = e.target as HTMLElement;
      if (target.closest('button, input, select, textarea')) return;

      e.stopPropagation();
      e.preventDefault();

      // The gesture adapts to the node's layout mode, with no positionType
      // conversion: an absolute node MOVES (drop writes `position`), an in-flow
      // node REORDERS among its siblings (drop splices the source order), taking
      // advantage of the flow instead of fighting it with a margin offset.
      // Margins stay editable in the properties panel; reparenting stays in the
      // Nodes tree.
      const isAbsolute = t?.positionType === YGPT_ABSOLUTE;

      // Anchor the snap grid where the node is RENDERED, not at its authored
      // top/left: an anchored node may have no px leading edge at all (a centered
      // pin is 50% + a counter-margin, a right/bottom pin has only the far edge).
      // Measured in inset space (see offsetInParent), the same space the drop
      // commits in, so the node lands exactly where it was released.
      const el = divRef.current;
      const start = el?.parentElement ? offsetInParent(el, el.parentElement) : { top: 0, left: 0 };
      dragOriginRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startTop: start.top,
        startLeft: start.left,
      };
      liveOffsetRef.current = { dx: 0, dy: 0 };
      setOptimisticPos(null);
      setHeldOffset(null);
      // Selection follows the drag — feels natural in every editor.
      dispatch(selectNode({ node: node.entity }));
      if (isAbsolute) {
        setIsDragging(true);
        return;
      }
      reorderRef.current = divRef.current ? captureReorderDrag(divRef.current) : null;
      if (reorderRef.current) setIsReordering(true);
    },
    [canDragMove, t, dispatch, node.entity, isLocked],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent) => {
      const origin = dragOriginRef.current;
      if (!origin) return;
      let dxLogical = (e.clientX - origin.mouseX) / getCanvasScale();
      let dyLogical = (e.clientY - origin.mouseY) / getCanvasScale();
      if (!e.shiftKey) {
        // Snap to grid by quantising the FINAL position, not the delta,
        // so the snapped grid is anchored to absolute logical coords.
        const snappedLeft =
          Math.round((origin.startLeft + dxLogical) / DRAG_SNAP_GRID) * DRAG_SNAP_GRID;
        const snappedTop =
          Math.round((origin.startTop + dyLogical) / DRAG_SNAP_GRID) * DRAG_SNAP_GRID;
        dxLogical = snappedLeft - origin.startLeft;
        dyLogical = snappedTop - origin.startTop;
      }
      liveOffsetRef.current = { dx: dxLogical, dy: dyLogical };
      setRenderTick(tick => tick + 1);
    };

    const handleUp = () => {
      const origin = dragOriginRef.current;
      const offset = liveOffsetRef.current;
      dragOriginRef.current = null;
      liveOffsetRef.current = { dx: 0, dy: 0 };
      setIsDragging(false);

      if (!origin) return;
      if (offset.dx === 0 && offset.dy === 0) return;
      const top = Math.round(origin.startTop + offset.dy);
      const left = Math.round(origin.startLeft + offset.dx);
      setOptimisticPos(dragPinHold(top, left, t as Record<string, unknown> | null));
      void spliceUiTransformPosition(node.entity as unknown as number, top, left);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, node.entity]);

  useEffect(() => {
    if (!isReordering) return;

    const handleMove = (e: MouseEvent) => {
      const origin = dragOriginRef.current;
      const ro = reorderRef.current;
      if (!origin || !ro) return;
      const scale = getCanvasScale();
      const dx = e.clientX - origin.mouseX;
      const dy = e.clientY - origin.mouseY;
      liveOffsetRef.current = { dx: dx / scale, dy: dy / scale };
      // Hit-test the dragged box's live center against the captured sibling boxes
      // — all still in viewport px, so the raw (unscaled) delta is what moves it.
      ro.slot = insertionSlot(
        ro.siblings.map(s => s.box),
        { x: ro.center.x + dx, y: ro.center.y + dy },
        ro.flow,
        ro.parentBox,
      );
      setRenderTick(tick => tick + 1);
    };

    const handleUp = () => {
      const ro = reorderRef.current;
      const offset = liveOffsetRef.current;
      reorderRef.current = null;
      dragOriginRef.current = null;
      liveOffsetRef.current = { dx: 0, dy: 0 };
      setIsReordering(false);
      if (!ro) return;
      // Nothing to write when the node was released over the slot it already
      // holds. The movement check is not redundant: siblings can overlap (negative
      // margins), so a node's resting center can already sit past a sibling's
      // midpoint and a plain click must never reorder.
      if ((offset.dx === 0 && offset.dy === 0) || ro.slot.index === ro.selfIndex) return;
      // Reorder by moving the element's source after the preceding sibling, or
      // before the first one when dropped at the head. The reparse reflows the
      // node into its new slot; the drop offset is held until it lands.
      const anchor: MoveAnchor =
        ro.slot.index > 0
          ? { kind: 'after', targetId: Number(ro.siblings[ro.slot.index - 1].entity) }
          : { kind: 'before', targetId: Number(ro.siblings[0].entity) };
      setHeldOffset(offset);
      void spliceMove(node.entity as unknown as number, anchor).finally(() => setHeldOffset(null));
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isReordering, node.entity]);

  // Release the reorder hold on the first reparse after the drop: the rebuilt tree
  // is what reflows the node into its new slot, and it arrives in the same React
  // batch, so no frame shows the node both reordered and offset. (Synthetic ids
  // are positional, so the moved node usually remounts under a new id and this
  // never runs — it covers the case where the id survives the move.)
  useEffect(() => {
    setHeldOffset(held => (held ? null : held));
  }, [node]);

  // Clear the optimistic hold once the committed transform matches the dropped
  // position (so external edits / the property panel drive rendering again).
  useEffect(() => {
    if (!optimisticPos) return;
    const t = node.uiTransform as PBUiTransform | undefined;
    const num = (v: unknown) => Math.round((v as number | undefined) ?? NaN);
    if (optimisticPos.top !== undefined && num(t?.positionTop) !== optimisticPos.top) return;
    if (optimisticPos.left !== undefined && num(t?.positionLeft) !== optimisticPos.left) return;
    if (optimisticPos.width !== undefined && num(t?.width) !== optimisticPos.width) return;
    if (optimisticPos.height !== undefined && num(t?.height) !== optimisticPos.height) return;
    // A margin the commit CLEARS comes back absent, not 0 — so an absent margin
    // has to read as the 0 it means in Yoga, or the hold never releases.
    const margin = (v: unknown) => Math.round((v as number | undefined) ?? 0);
    if (optimisticPos.marginTop !== undefined && margin(t?.marginTop) !== optimisticPos.marginTop)
      return;
    if (
      optimisticPos.marginLeft !== undefined &&
      margin(t?.marginLeft) !== optimisticPos.marginLeft
    )
      return;
    setOptimisticPos(null);
  }, [node, optimisticPos]);

  // --- Resize handle interaction ---
  const handleResizeStart = useCallback(
    (dir: HandleDir) => (e: React.MouseEvent) => {
      if (isLocked || !divRef.current) return;
      e.stopPropagation();
      e.preventDefault();
      const el = divRef.current;
      const parentEl = el.parentElement;
      if (!parentEl) return;
      // Read the rendered box from the DOM rather than the PB component —
      // works regardless of unit (%, px, auto) since getBoundingClientRect
      // returns post-layout viewport pixels which we convert with CANVAS_SCALE.
      const elRect = el.getBoundingClientRect();
      const start = offsetInParent(el, parentEl);
      resizeOriginRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startTop: start.top,
        startLeft: start.left,
        startW: elRect.width / getCanvasScale(),
        startH: elRect.height / getCanvasScale(),
        dir,
        isAbsolute: (t?.positionType ?? YGPT_RELATIVE) === YGPT_ABSOLUTE,
      };
      resizeLiveRef.current = { dx: 0, dy: 0, dw: 0, dh: 0 };
      setOptimisticPos(null);
      setIsResizing(true);
      dispatch(selectNode({ node: node.entity }));
    },
    [dispatch, node.entity, isLocked],
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e: MouseEvent) => {
      const origin = resizeOriginRef.current;
      if (!origin) return;
      const dxRaw = (e.clientX - origin.mouseX) / getCanvasScale();
      const dyRaw = (e.clientY - origin.mouseY) / getCanvasScale();
      const axes = HANDLE_AXES[origin.dir];

      // The box follows the dragged handle in BOTH layout modes: left/top edges
      // move the top-left (axes.dx/dy) while shrinking width/height (axes.dw/dh),
      // so the opposite edge stays put and the box grows toward the dragged edge.
      // The live translate and the commit both honor this (in-flow nodes commit
      // the top-left shift as margin), so the preview matches the result.
      // Snap the FINAL position/size, not the delta, so the grid is anchored
      // to absolute logical coords (consistent with move).
      const snap = (v: number) => Math.round(v / DRAG_SNAP_GRID) * DRAG_SNAP_GRID;
      const doSnap = !e.shiftKey;

      let nextW = origin.startW + dxRaw * axes.dw;
      let nextH = origin.startH + dyRaw * axes.dh;

      if (doSnap) {
        nextW = snap(nextW);
        nextH = snap(nextH);
      }
      // Don't allow negative sizes — clamp at 0.
      nextW = Math.max(0, nextW);
      nextH = Math.max(0, nextH);

      // Aspect-ratio lock (Size toggle) or Ctrl held → constrain to the node's
      // original W:H. The axis that moved more (normalised by the ratio) drives;
      // the other is derived. macOS turns Ctrl+click into a secondary click, so
      // the handles preventDefault their contextmenu (see render).
      if ((aspectLockedRef.current || e.ctrlKey) && origin.startW > 0 && origin.startH > 0) {
        const ratio = origin.startW / origin.startH;
        const drivesWidth =
          axes.dw !== 0 &&
          (axes.dh === 0 ||
            Math.abs(nextW - origin.startW) * origin.startH >=
              Math.abs(nextH - origin.startH) * origin.startW);
        if (drivesWidth) nextH = Math.max(0, nextW / ratio);
        else nextW = Math.max(0, nextH * ratio);
      }

      // Keep the edge opposite the dragged handle fixed by deriving the top-left
      // from the (possibly constrained) size, so left/top drags grow toward the
      // handle and the anchor never drifts. dx===1 ⇔ a left-moving handle;
      // dy===1 ⇔ a top-moving handle.
      const nextLeft =
        axes.dx === 1 ? origin.startLeft + (origin.startW - nextW) : origin.startLeft;
      const nextTop = axes.dy === 1 ? origin.startTop + (origin.startH - nextH) : origin.startTop;

      resizeLiveRef.current = {
        dx: nextLeft - origin.startLeft,
        dy: nextTop - origin.startTop,
        dw: nextW - origin.startW,
        dh: nextH - origin.startH,
      };
      setRenderTick(tick => tick + 1);
    };

    const handleUp = () => {
      const origin = resizeOriginRef.current;
      const live = resizeLiveRef.current;
      resizeOriginRef.current = null;
      resizeLiveRef.current = { dx: 0, dy: 0, dw: 0, dh: 0 };
      setIsResizing(false);
      if (!origin) return;
      if (live.dw === 0 && live.dh === 0 && live.dx === 0 && live.dy === 0) return;
      // Commit size AND the top-left shift the handle produced, in one splice, so
      // a left/top-edge drag grows toward that edge instead of always down-right.
      const width = Math.max(0, Math.round(origin.startW + live.dw));
      const height = Math.max(0, Math.round(origin.startH + live.dh));
      const id = node.entity as unknown as number;
      const hasMove = live.dx !== 0 || live.dy !== 0;
      if (origin.isAbsolute) {
        // Absolute → reposition via `position: { top, left }`.
        const top = Math.round(origin.startTop + live.dy);
        const left = Math.round(origin.startLeft + live.dx);
        setOptimisticPos(
          hasMove
            ? { ...dragPinHold(top, left, t as Record<string, unknown> | null), width, height }
            : { width, height },
        );
        void spliceUiTransformResize(id, {
          width,
          height,
          position: hasMove ? { top, left } : undefined,
        });
      } else {
        // In-flow → shift via `margin` (current + delta), mirroring the move path.
        // Right/bottom-edge drags leave dx/dy at 0, so margin is left untouched.
        const marginTop = Math.round(((t?.marginTop as number) ?? 0) + live.dy);
        const marginLeft = Math.round(((t?.marginLeft as number) ?? 0) + live.dx);
        setOptimisticPos(hasMove ? { marginTop, marginLeft, width, height } : { width, height });
        void spliceUiTransformResize(id, {
          width,
          height,
          margin: hasMove ? { top: marginTop, left: marginLeft } : undefined,
        });
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing, node.entity]);

  // Apply the live drag offset visually via CSS transform so we don't write
  // to the CRDT/data-layer until the user releases the mouse.
  const baseStyle = nodeStyle(previewNode);
  const liveOffset = isDragging || isReordering ? liveOffsetRef.current : heldOffset;
  let style: React.CSSProperties = liveOffset
    ? {
        ...baseStyle,
        transform:
          `${baseStyle.transform ?? ''} translate(${liveOffset.dx}px, ${liveOffset.dy}px)`.trim(),
      }
    : baseStyle;
  if (isResizing) {
    const live = resizeLiveRef.current;
    const origin = resizeOriginRef.current;
    if (origin) {
      style = {
        ...style,
        width: `${Math.max(0, origin.startW + live.dw)}px`,
        height: `${Math.max(0, origin.startH + live.dh)}px`,
        transform: `${baseStyle.transform ?? ''} translate(${live.dx}px, ${live.dy}px)`.trim(),
      };
    }
  }

  // Hold the just-dropped position until the committed transform catches up,
  // preventing the snap-back-then-jump flicker on release.
  if (optimisticPos && !isDragging && !isResizing) {
    style = { ...style };
    if (optimisticPos.top !== undefined && optimisticPos.left !== undefined) {
      style.position = 'absolute';
      style.top = `${optimisticPos.top}px`;
      style.left = `${optimisticPos.left}px`;
      // The commit degrades the node to a top-left pin, so drop the pin it had: a
      // stale right/bottom held next to the new top/left would stretch the box.
      style.right = undefined;
      style.bottom = undefined;
    }
    if (optimisticPos.width !== undefined) style.width = `${optimisticPos.width}px`;
    if (optimisticPos.height !== undefined) style.height = `${optimisticPos.height}px`;
    // The margins the commit rewrites: 0 for a counter-margin a drop clears, the
    // shifted value for an in-flow resize. A margin the commit leaves authored is
    // absent here, and the held inset already compensates for it.
    if (optimisticPos.marginTop !== undefined) style.marginTop = `${optimisticPos.marginTop}px`;
    if (optimisticPos.marginLeft !== undefined) style.marginLeft = `${optimisticPos.marginLeft}px`;
  }

  // Layer the resolved file-texture on top. backgroundColor (a separate
  // property) survives as a fallback while the blob URL is still loading.
  if (texUrl) {
    style = { ...style, ...textureStyle(texUrl, background.textureMode, background.uvs) };
  }

  // The root IS the screen: its authored size/position must never distort the
  // frame. Force it to fill the .ui-designer-canvas-root box regardless of what
  // its stored UiTransform says (a legacy root may have been saved absolute or
  // a fixed 1920px). The runtime + repair op keep it 100% relative; this is the
  // editor-side guarantee.
  if (isRoot) {
    style = {
      ...style,
      position: 'relative',
      width: '100%',
      height: '100%',
      top: undefined,
      right: undefined,
      bottom: undefined,
      left: undefined,
      marginTop: undefined,
      marginRight: undefined,
      marginBottom: undefined,
      marginLeft: undefined,
    };
  }

  return (
    <div
      ref={setRef}
      className={cx('ui-designer-canvas-node', {
        selected: isSelected,
        'drop-over': isOver,
        dragging: isDragging || isReordering,
        reordering: isReordering,
        resizing: isResizing,
        movable: canDragMove,
      })}
      style={hiddenStyle(style, hidden)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      // Preview the Hover layer while pointing at the node. Enter/leave don't
      // collide with the canvas gestures (which are click / mousedown-drag), so
      // this is safe where a mousedown-driven "pressed" preview would not be.
      // Only nodes that actually declare a hover layer subscribe to the cost.
      onMouseEnter={node.interaction?.states.hover ? () => setCanvasHovered(true) : undefined}
      onMouseLeave={node.interaction?.states.hover ? () => setCanvasHovered(false) : undefined}
      data-type={node.type}
      data-entity={String(node.entity)}
    >
      {node.type === 'Input' ? <span className="ui-designer-canvas-input">{inputText}</span> : null}
      {node.type === 'Dropdown' ? (
        <span className="ui-designer-canvas-dropdown">
          <span className="ui-designer-canvas-dropdown-label">
            {dropdown.options?.[dropdown.selectedIndex ?? 0] ?? dropdown.emptyLabel ?? 'Select…'}
          </span>
          <span className="ui-designer-canvas-dropdown-chevron">▼</span>
        </span>
      ) : null}
      {/* Label/Button text: a mixed-content editor while editing (double-click) —
          literal text + variable/prop chips — else the resolved preview text.
          Button had no text branch before, so it painted as an empty box. */}
      {rendersText(node.type) ? (
        editing ? (
          <span
            className="ui-designer-canvas-inline-edit"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            <MixedContentField
              field={TEXT_VALUE_FIELD}
              entity={node.entity}
              autoFocus
              segments={seedSegments(
                text.value,
                node.bindings?.find(b => b.field === 'core::UiText.value' && b.segments?.length)
                  ?.segments,
                node.bindings?.find(b => b.field === 'core::UiText.value' && !b.segments?.length)
                  ?.variable,
              )}
            />
          </span>
        ) : labelText ? (
          <span className="ui-designer-canvas-text">{labelText}</span>
        ) : null
      ) : null}
      {node.children.map(child => (
        <CanvasNodeView
          key={String(child.entity)}
          node={child}
        />
      ))}
      {showResizeHandles
        ? HANDLE_DIRS.map(dir => (
            <span
              key={dir}
              className={cx('ui-designer-resize-handle', dir)}
              onMouseDown={handleResizeStart(dir)}
              // Ctrl+drag constrains the ratio; on macOS Ctrl+click is a
              // secondary click, so suppress the context menu on the handle.
              onContextMenu={e => e.preventDefault()}
            />
          ))
        : null}
      {isSelected && !isRoot ? <CanvasNodeActions entity={node.entity} /> : null}
      {/* Portaled into the PARENT so the line spans the slot it marks, not this
          node's box. It is absolutely positioned, so it adds no flex item. */}
      {isReordering && reorderRef.current && reorderRef.current.siblings.length > 0
        ? createPortal(
            <div
              className="ui-designer-reorder-indicator"
              style={reorderIndicatorStyle(reorderRef.current)}
            />,
            reorderRef.current.parentEl,
          )
        : null}
    </div>
  );
};

// A grayed, read-only stand-in for code the UI Designer can't represent (loops,
// conditionals, custom components, spread/dynamic props). It keeps the node's
// place in the layout and is selectable (so the code view can locate it), but
// carries none of the drag/resize/drop machinery — it is edited only in code.
const CanvasOpaqueNode: React.FC<{ node: CodeUINode; hidden?: boolean }> = ({ node, hidden }) => {
  const dispatch = useAppDispatch();
  const isSelected = useAppSelector(state => getSelectedNodes(state).includes(node.entity));
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) registerNodeElement(node.entity, el);
      else unregisterNodeElement(node.entity);
    },
    [node.entity],
  );
  const reason = node.opaque?.reason ?? 'non-standard';
  return (
    <div
      ref={setRef}
      className={cx('ui-designer-canvas-node', 'opaque', { selected: isSelected })}
      style={hiddenStyle(nodeStyle(node), hidden)}
      onClick={e => {
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey || e.shiftKey)
          dispatch(toggleNodeSelection({ node: node.entity }));
        else dispatch(selectNode({ node: node.entity }));
      }}
      data-type={node.type}
      data-entity={String(node.entity)}
      title={`Doesn't follow the UI Designer convention (${reason}) — edit in code`}
    >
      <span className="ui-designer-canvas-opaque-badge">⚠ non-standard · edit in code</span>
    </div>
  );
};

// Read-only recursive render of a resolved component tree (Phase 2). Purely
// visual: applies nodeStyle + text/background like CanvasNode, but registers no
// node element and wires no interaction (its ids belong to another file and must
// not collide with the active tree). `pointer-events: none` (on the root) lets
// clicks fall through to the enclosing component-ref block, so selecting still
// targets the reference, not its internals.
const CanvasReadonlyNode: React.FC<{
  node: CodeUINode;
  resolveMap: Record<string, string>;
  isRoot?: boolean;
}> = ({ node, resolveMap, isRoot }) => {
  const resolve = useCallback((expr: string) => resolveMap[expr], [resolveMap]);
  let style = nodeStyle(node);
  if (isRoot) {
    // The nested component fills the block the wrapper sizes — neutralize its own
    // root transform (a standalone root may be absolute / fixed-size).
    style = {
      ...style,
      position: 'relative',
      width: '100%',
      height: '100%',
      top: undefined,
      left: undefined,
      right: undefined,
      bottom: undefined,
      marginTop: undefined,
      marginRight: undefined,
      marginBottom: undefined,
      marginLeft: undefined,
      pointerEvents: 'none',
    };
  }
  const text = (node.uiText ?? {}) as { value?: string };
  const input = (node.uiInput ?? {}) as { placeholder?: string; value?: string };
  const dropdown = (node.uiDropdown ?? {}) as {
    options?: string[];
    selectedIndex?: number;
    emptyLabel?: string;
  };
  const labelText = rendersText(node.type)
    ? previewBoundText(node.bindings, 'core::UiText.value', text.value ?? '', resolve)
    : '';
  const inputText =
    node.type === 'Input'
      ? previewBoundText(node.bindings, 'core::UiInput.value', input.value ?? '', resolve) ||
        previewBoundText(
          node.bindings,
          'core::UiInput.placeholder',
          input.placeholder ?? '',
          resolve,
        ) ||
        'Input'
      : '';
  return (
    <div
      className="ui-designer-canvas-readonly-node"
      style={style}
      data-type={node.type}
    >
      {node.componentRef ? (
        <span className="ui-designer-canvas-component-badge">◈ {node.componentRef.name}</span>
      ) : null}
      {node.type === 'Input' ? <span className="ui-designer-canvas-input">{inputText}</span> : null}
      {node.type === 'Dropdown' ? (
        <span className="ui-designer-canvas-dropdown">
          <span className="ui-designer-canvas-dropdown-label">
            {dropdown.options?.[dropdown.selectedIndex ?? 0] ?? dropdown.emptyLabel ?? 'Select…'}
          </span>
          <span className="ui-designer-canvas-dropdown-chevron">▼</span>
        </span>
      ) : null}
      {rendersText(node.type) && labelText ? (
        <span className="ui-designer-canvas-text">{labelText}</span>
      ) : null}
      {node.children.map(child => (
        <CanvasReadonlyNode
          key={String(child.entity)}
          node={child}
          resolveMap={resolveMap}
        />
      ))}
    </div>
  );
};

// A first-class reference to another root used as a component (`<OtroNOmbre />`).
// Unlike an opaque block it is selectable (and movable/removable via the tree +
// actions, since its span is a real JSX element); it's edited in code by opening
// the referenced root. When the referenced tree has resolved it renders inline
// read-only (edits to the original reflect here); until then, a labeled block.
const CanvasComponentRefNode: React.FC<{ node: CodeUINode; hidden?: boolean }> = ({
  node,
  hidden,
}) => {
  const isSelected = useAppSelector(state => getSelectedNodes(state).includes(node.entity));
  const { componentTrees } = useCodeState();
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) registerNodeElement(node.entity, el);
      else unregisterNodeElement(node.entity);
    },
    [node.entity],
  );
  const name = node.componentRef?.name ?? node.name;
  const resolved = componentTrees[name] ?? null;
  // pointer-events:none (CSS) makes this block transparent — clicks/drags reach
  // the wrapper UiEntity (the movable/resizable unit). Selection outline still
  // shows when the ref is picked in the node tree.
  return (
    <div
      ref={setRef}
      className={cx('ui-designer-canvas-node', 'component-ref', { selected: isSelected })}
      style={hiddenStyle(
        { minWidth: 80, minHeight: 40, width: '100%', height: '100%', ...nodeStyle(node) },
        hidden,
      )}
      data-type="component-ref"
      data-entity={String(node.entity)}
      title={`<${name} /> — a nested UI component. Edit it by opening "${name}".`}
    >
      {resolved?.parsed ? (
        <CanvasReadonlyNode
          node={resolved.parsed.root}
          resolveMap={resolved.resolveMap}
          isRoot
        />
      ) : (
        <span className="ui-designer-canvas-component-badge">◈ {name}</span>
      )}
    </div>
  );
};

// Route each node to the right renderer: a component reference gets the
// first-class block, anything flagged opaque gets the read-only block, and
// representable nodes get the full interactive CanvasNode. A node flipping
// between these (as code is edited) swaps component type, which remounts cleanly
// — no shared hook state to get out of sync.
const CanvasNodeView: React.FC<CanvasNodeProps> = ({ node }) => {
  // Editor-only canvas hide (tree eye button): rendered with visibility:
  // hidden so the layout box stays (siblings don't reflow) — code untouched.
  const isNodeHidden = useAppSelector(
    state => !!getHiddenNodes(state)[node.entity as unknown as number],
  );
  const platform = useAppSelector(getPlatform);
  const cn = node as CodeUINode;
  // A platform variant contributes no box of its own — render the branch for the
  // device being previewed. Nothing when that device has no branch, which is
  // exactly what the scene renders there.
  if (cn.platformVariant) {
    const branch = cn.children.find(c => c.platform === platform);
    return branch ? <CanvasNodeView node={branch} /> : null;
  }
  if (cn.componentRef)
    return (
      <CanvasComponentRefNode
        node={cn}
        hidden={isNodeHidden}
      />
    );
  if (cn.opaque)
    return (
      <CanvasOpaqueNode
        node={cn}
        hidden={isNodeHidden}
      />
    );
  return (
    <CanvasNode
      node={node}
      hidden={isNodeHidden}
    />
  );
};

// Shown when a GUI is selected but its component is EMPTY (a plain `return`, no
// elements). A drop target for the first element: drag a widget from the palette,
// or click "+ Add element". Either routes through spliceSetRootChild, which
// splices the `return (<…/>)` and turns the empty root into a real tree.
const EmptyRootDropZone: React.FC = () => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [{ isOver }, drop] = useDrop<UIDesignerDragItem, unknown, { isOver: boolean }>(
    () => ({
      accept: UI_DESIGNER_DND_TYPE,
      drop: (item, monitor) => {
        if (monitor.didDrop()) return;
        if (item.source === 'palette') void spliceSetRootChild(item.type, item.preset);
      },
      collect: monitor => ({ isOver: monitor.isOver({ shallow: true }) }),
    }),
    [],
  );
  return (
    // The drop ref sits on the full-bleed wrapper — the whole empty canvas
    // accepts the first element, not just the dashed box (#1399).
    <div
      ref={drop}
      className={cx('ui-designer-canvas-empty', { over: isOver })}
    >
      <div className="ui-designer-canvas-emptyroot">
        <p className="ui-designer-canvas-emptyroot-title">This GUI is empty</p>
        <p className="ui-designer-canvas-emptyroot-hint">
          Drag a widget from the palette here to add your first element.
        </p>
        <button
          ref={btnRef}
          type="button"
          className="ui-designer-canvas-emptyroot-add"
          onClick={() => setPickerOpen(true)}
        >
          + Add element
        </button>
        {pickerOpen ? (
          <WidgetPicker
            anchorRef={btnRef}
            onAdd={(type, preset) => void spliceSetRootChild(type, preset)}
            onDismiss={() => setPickerOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
};

const CanvasComponent: React.FC = () => {
  const tree = useUINodeTree();
  // Resolve `state.<var>` → its default value for the text preview (built once
  // here; every CanvasNode reads it via VarPreviewContext).
  const { bindingSurface, emptyRoot } = useCodeState();
  const resolveVar = useMemo(() => {
    const map = buildResolveMap(bindingSurface.variables);
    return (expr: string) => map[expr];
  }, [bindingSurface]);
  // Code-mode roots are files under src/ui/ (see code/store), not ECS entities.
  const createRoot = useCallback(() => void createCodeRoot(), []);
  const selectedNode = useAppSelector(getSelectedNode);
  const [scale, setScale] = useState(getCanvasScale());
  // The device toggle is the EDIT target, not just a preview: a platform-variant
  // node renders (and routes edits to) the branch matching it, so it lives in the
  // slice where the code store can read it too.
  const dispatch = useAppDispatch();
  const device = useAppSelector(getPlatform);
  const [showSafeAreas, setShowSafeAreas] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  // Infinite-canvas pan (Figma-style): the viewport centres the stage and this
  // translate offsets it, so it can be moved anywhere at any zoom.
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panDragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(
    null,
  );
  const [isPanning, setIsPanning] = useState(false);

  // A node selected from the tree / roots list that's fully off-screen is
  // recentred by adjusting the pan; an already-visible node never jumps the view.
  useEffect(() => {
    if (selectedNode === null) return;
    const vp = viewportRef.current;
    const el = getNodeElement(selectedNode);
    if (!vp || !el) return;
    requestAnimationFrame(() => {
      const er = el.getBoundingClientRect();
      const vr = vp.getBoundingClientRect();
      const offscreen =
        er.right < vr.left || er.left > vr.right || er.bottom < vr.top || er.top > vr.bottom;
      if (!offscreen) return;
      setPan(p => ({
        x: p.x + (vr.left + vr.width / 2 - (er.left + er.width / 2)),
        y: p.y + (vr.top + vr.height / 2 - (er.top + er.height / 2)),
      }));
    });
  }, [selectedNode]);

  // Per-UI design canvas size. The stage reserves the *scaled* footprint so the
  // canvas holds a strict size and the viewport scrolls when it overflows.
  const canvasWidth = tree?.canvasWidth ?? DEFAULT_CANVAS_WIDTH;
  const canvasHeight = tree?.canvasHeight ?? DEFAULT_CANVAS_HEIGHT;

  // Mobile preview: the UI is scaled to fit a reference device screen (mirrors
  // the runtime materializeRoot formula), letterboxed inside the device frame.
  const fitScale =
    device === 'mobile'
      ? Math.min(MOBILE_REFERENCE.width / canvasWidth, MOBILE_REFERENCE.height / canvasHeight)
      : 1;

  // Keep the module-level scale (read by the drag/resize coordinate math and by
  // measure.ts) in sync with the rendered zoom. In the device frame the UI carries
  // a second scale-to-fit transform, so the EFFECTIVE scale is the product — that
  // is what the px↔logical conversions must divide by for editing to track the
  // pointer there.
  useEffect(() => {
    setCanvasScale(scale * fitScale);
  }, [scale, fitScale]);

  // Defensive: drop any stale entity→element entries when the canvas unmounts
  // (e.g. switching scenes). Individual node unmounts already unregister via
  // `setRef`; this guards against an entry surviving a full canvas teardown.
  useEffect(() => () => clearNodeRegistry(), []);

  // Wheel pans; ctrl/⌘ + wheel zooms. Non-passive so preventDefault stops the
  // browser page-zoom / back-swipe.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        setScale(s => clampZoom(s - e.deltaY * 0.0015));
        return;
      }
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Right-/middle-drag pans.
  const handlePanStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 2 && e.button !== 1) return;
      e.preventDefault();
      panDragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
      setIsPanning(true);
    },
    [pan.x, pan.y],
  );

  useEffect(() => {
    if (!isPanning) return;
    const move = (e: MouseEvent) => {
      const o = panDragRef.current;
      if (!o) return;
      setPan({ x: o.panX + (e.clientX - o.startX), y: o.panY + (e.clientY - o.startY) });
    };
    const up = () => {
      panDragRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [isPanning]);

  return (
    <VarPreviewContext.Provider value={resolveVar}>
      <div
        ref={viewportRef}
        className={cx('ui-designer-canvas-viewport', { panning: isPanning })}
        onMouseDown={handlePanStart}
        onContextMenu={e => e.preventDefault()}
      >
        <div className="ui-designer-canvas-stagewrap">
          {tree ? (
            <>
              {device === 'desktop' ? (
                <div
                  className="ui-designer-canvas-stage"
                  style={{
                    width: canvasWidth * scale,
                    height: canvasHeight * scale,
                    transform: `translate(${pan.x}px, ${pan.y}px)`,
                  }}
                >
                  <div
                    className="ui-designer-canvas-root"
                    style={
                      {
                        width: canvasWidth,
                        height: canvasHeight,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        // Exposed so selection chrome (action bar) can counter-scale to
                        // stay legible at any zoom without re-rendering each node.
                        '--uid-scale': scale,
                      } as React.CSSProperties
                    }
                  >
                    <CanvasNodeView node={tree} />
                    {showSafeAreas ? (
                      <SafeAreaOverlay
                        width={canvasWidth}
                        height={canvasHeight}
                        device="desktop"
                      />
                    ) : null}
                  </div>
                </div>
              ) : (
                <div
                  className="ui-designer-device-frame"
                  style={{
                    width: MOBILE_REFERENCE.width * scale,
                    height: MOBILE_REFERENCE.height * scale,
                    transform: `translate(${pan.x}px, ${pan.y}px)`,
                  }}
                >
                  <div
                    className="ui-designer-device-screen"
                    style={
                      {
                        width: MOBILE_REFERENCE.width,
                        height: MOBILE_REFERENCE.height,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        '--uid-scale': scale * fitScale,
                      } as React.CSSProperties
                    }
                  >
                    {/* UI scaled-to-fit + letterboxed inside the device screen.
                        Editable: drag/resize math is delta-based over client rects
                        divided by the effective scale, so the extra transform and
                        the letterbox offset both cancel out. */}
                    <div
                      className="ui-designer-canvas-root"
                      style={{
                        width: canvasWidth,
                        height: canvasHeight,
                        transform: `scale(${fitScale})`,
                        transformOrigin: 'top left',
                        position: 'absolute',
                        left: (MOBILE_REFERENCE.width - canvasWidth * fitScale) / 2,
                        top: (MOBILE_REFERENCE.height - canvasHeight * fitScale) / 2,
                      }}
                    >
                      <CanvasNodeView node={tree} />
                    </div>
                    {showSafeAreas ? (
                      <SafeAreaOverlay
                        width={MOBILE_REFERENCE.width}
                        height={MOBILE_REFERENCE.height}
                        device="mobile"
                      />
                    ) : null}
                  </div>
                </div>
              )}
            </>
          ) : emptyRoot ? (
            <EmptyRootDropZone />
          ) : (
            <div className="ui-designer-canvas-empty">
              <EmptyState
                icon={<IoLayersOutline />}
                title="No GUI yet"
                message="Create a GUI to start designing your scene's interface, then drag widgets from the palette below."
                action={<Button onClick={createRoot}>+ New GUI</Button>}
              />
            </div>
          )}
        </div>
        {tree ? (
          <div className="ui-designer-canvas-zoom">
            <button
              type="button"
              className="ui-designer-canvas-zoom-btn"
              onClick={() => setScale(s => clampZoom(s - ZOOM_STEP))}
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              className="ui-designer-canvas-zoom-level"
              onClick={() => {
                setScale(DEFAULT_CANVAS_SCALE);
                setPan({ x: 0, y: 0 });
              }}
              title="Reset view"
              aria-label="Reset view"
              aria-live="polite"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              className="ui-designer-canvas-zoom-btn"
              onClick={() => setScale(s => clampZoom(s + ZOOM_STEP))}
              aria-label="Zoom in"
            >
              +
            </button>
            <span className="ui-designer-canvas-zoom-sep" />
            <button
              type="button"
              className={cx('ui-designer-canvas-zoom-btn', { active: device === 'desktop' })}
              onClick={() => dispatch(setPlatform({ platform: 'desktop' }))}
              title="Desktop preview"
              aria-label="Desktop preview"
              aria-pressed={device === 'desktop'}
            >
              <IoDesktopOutline />
            </button>
            <button
              type="button"
              className={cx('ui-designer-canvas-zoom-btn', { active: device === 'mobile' })}
              onClick={() => dispatch(setPlatform({ platform: 'mobile' }))}
              title="Mobile preview"
              aria-label="Mobile preview"
              aria-pressed={device === 'mobile'}
            >
              <IoPhoneLandscapeOutline />
            </button>
            <button
              type="button"
              className={cx('ui-designer-canvas-zoom-btn', { active: showSafeAreas })}
              onClick={() => setShowSafeAreas(s => !s)}
              title="Toggle safe-area guides"
              aria-label="Toggle safe-area guides"
              aria-pressed={showSafeAreas}
            >
              <IoScanOutline />
            </button>
          </div>
        ) : null}
      </div>
    </VarPreviewContext.Provider>
  );
};

export const Canvas = React.memo(CanvasComponent);

export default Canvas;
