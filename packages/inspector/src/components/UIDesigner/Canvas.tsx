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
import { getSelectedNode, getTool, selectNode } from '../../redux/ui-designer';
import { Button } from '../Button';
import { UI_DESIGNER_DND_TYPE, type UIDesignerDragItem } from './Palette';
import { EmptyState } from './EmptyState';
import { WidgetPicker } from './WidgetPicker';
import { SafeAreaOverlay } from './SafeAreaOverlay';
import { MOBILE_REFERENCE, type DeviceKind } from './safe-areas';
import { useUINodeActions } from './useUINodeActions';
import { useUINodeTree } from './useUINodeTree';
import {
  createRoot as createCodeRoot,
  spliceAddChild,
  spliceInsertComponent,
  spliceMove,
  spliceUiTransformMargin,
  spliceUiTransformPosition,
  spliceUiTransformSize,
  useCodeState,
} from './code/store';
import { buildResolveMap } from './code/bindings';
import type { CodeUINode } from './code/types';
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
import {
  YGU_UNDEFINED,
  YGU_POINT,
  YGU_PERCENT,
  YGU_AUTO,
  YGD_NONE,
  YGPT_RELATIVE,
  YGPT_ABSOLUTE,
} from '../../lib/sdk/ui-transform-constants';

// The canvas size is per-UI (canvasWidth × canvasHeight on the root's
// `asset-packs::UI` marker, default 1920×1080) — it is the UI's design/virtual
// resolution, scaled to fit the player's screen at runtime. The default visual
// scale below is the EDITOR zoom (the user can zoom; see CanvasComponent).
// `canvasScale` is the LIVE zoom, read by the drag/resize coordinate math and by
// measure.ts so px↔% conversions stay correct at any zoom level.
export const DEFAULT_CANVAS_SCALE = 0.4;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;
const clampZoom = (s: number): number =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(s * 100) / 100));

let canvasScale = DEFAULT_CANVAS_SCALE;
export function getCanvasScale(): number {
  return canvasScale;
}
export function setCanvasScale(scale: number): void {
  canvasScale = scale;
}

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
      if (color) (style as Record<string, unknown>)[`border${side}Color`] = color4ToRgba(color);
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
  // Label text: anchor the text span in its box exactly as react-ecs does. The
  // textAlign enum drives BOTH axes via flexbox (justify = horizontal, align =
  // vertical), overriding the generic container justify/align — a Label's only
  // "child" is its text. An unset textAlign anchors middle-center (4): the
  // in-world default per @dcl/ecs PBUiText ("alignment within the bounds
  // (default: center)"), NOT the proto-3 zero (top-left).
  if (node.type === 'Label') {
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

// Compute the insertion-indicator line for a reorder drag, in the parent's
// local (logical) px — the portal target is the parent node, which lives inside
// the scaled canvas root, so logical px are correct as-is.
function reorderIndicatorStyle(ro: {
  parentEl: HTMLElement;
  axis: 'x' | 'y';
  reversed: boolean;
  siblings: { entity: Entity; el: HTMLElement }[];
  index: number;
}): React.CSSProperties {
  const parentRect = ro.parentEl.getBoundingClientRect();
  const scale = getCanvasScale();
  const before = ro.index > 0 ? ro.siblings[ro.index - 1].el.getBoundingClientRect() : null;
  const after =
    ro.index < ro.siblings.length ? ro.siblings[ro.index].el.getBoundingClientRect() : null;
  if (ro.axis === 'x') {
    const prevEdge = ro.reversed
      ? (before?.left ?? parentRect.right)
      : (before?.right ?? parentRect.left);
    const nextEdge = ro.reversed
      ? (after?.right ?? parentRect.left)
      : (after?.left ?? parentRect.right);
    return {
      position: 'absolute',
      left: ((prevEdge + nextEdge) / 2 - parentRect.left) / scale - 1,
      top: 0,
      width: 2,
      height: parentRect.height / scale,
      pointerEvents: 'none',
    };
  }
  const prevEdge = ro.reversed
    ? (before?.top ?? parentRect.bottom)
    : (before?.bottom ?? parentRect.top);
  const nextEdge = ro.reversed
    ? (after?.bottom ?? parentRect.top)
    : (after?.top ?? parentRect.bottom);
  return {
    position: 'absolute',
    top: ((prevEdge + nextEdge) / 2 - parentRect.top) / scale - 1,
    left: 0,
    height: 2,
    width: parentRect.width / scale,
    pointerEvents: 'none',
  };
}

type CanvasNodeProps = { node: UINode };

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

const CanvasNode: React.FC<CanvasNodeProps> = ({ node }) => {
  const dispatch = useAppDispatch();
  // Subscribe to a derived boolean rather than the raw selected-entity id: selecting
  // a node is a Redux action that does NOT rebuild the node tree, so a raw
  // `getSelectedNode` subscription would re-render every CanvasNode on each click.
  // react-redux only re-renders when the selector OUTPUT changes, so this confines
  // the re-render to the two nodes whose selection actually flips.
  const isSelected = useAppSelector(state => getSelectedNode(state) === node.entity);
  const tool = useAppSelector(getTool);
  const text = (node.uiText ?? {}) as { value?: string };
  const input = (node.uiInput ?? {}) as { placeholder?: string; value?: string };
  const dropdown = (node.uiDropdown ?? {}) as {
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
  const background = (node.uiBackground ?? {}) as {
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
          void spliceAddChild(node.entity as unknown as number, item.type as UINodeType);
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
  const canDragMove = !isRoot && tool === 'move';
  const showResizeHandles = !isRoot && tool === 'resize' && isSelected;

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
  // Dragging an in-flow node reorders it among its in-flow siblings along the
  // parent's flex axis (Figma/Penpot flex-layout semantics) — it NEVER changes
  // positionType. Alt+drag opts into the legacy convert-to-absolute move.
  const reorderRef = useRef<{
    parentEl: HTMLElement;
    axis: 'x' | 'y';
    reversed: boolean;
    // In-flow siblings excluding self, in DOM order (= flow order).
    siblings: { entity: Entity; el: HTMLElement }[];
    // Insertion index (into the `siblings` gaps, 0..siblings.length) that
    // equals a no-op drop, and the live index under the cursor.
    selfIndex: number;
    index: number;
  } | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  // Hold the drag offset after a reorder drop until the committed `rightOf`
  // lands (same async round-trip rationale as `optimisticPos`).
  const [pendingReorder, setPendingReorder] = useState<{
    rightOf: number;
    dx: number;
    dy: number;
  } | null>(null);

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

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(selectNode({ node: node.entity }));
    },
    [dispatch, node.entity],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!canDragMove) return;
      // Ignore clicks inside inputs / interactive children so the property
      // panel doesn't end up dragging the parent node.
      const target = e.target as HTMLElement;
      if (target.closest('button, input, select, textarea')) return;

      e.stopPropagation();
      e.preventDefault();

      // Canvas drag = MOVE. Reorder / reparent live in the Nodes tree, so a drag
      // never has to disambiguate move-vs-reorder. The move adapts to the node's
      // layout mode on drop (see the drag handleUp): absolute → position,
      // in-flow → margin. No positionType conversion.
      const isAbsolute = t?.positionType === YGPT_ABSOLUTE;

      // Anchor the drag at the node's current rendered position (relative to its
      // parent) for the live snap grid; in-flow nodes read it from the DOM.
      let startTop = (t?.positionTop ?? 0) as number;
      let startLeft = (t?.positionLeft ?? 0) as number;
      if (!isAbsolute) {
        const el = divRef.current;
        const parentEl = el?.parentElement;
        if (el && parentEl) {
          const elRect = el.getBoundingClientRect();
          const parentRect = parentEl.getBoundingClientRect();
          startLeft = Math.round((elRect.left - parentRect.left) / getCanvasScale());
          startTop = Math.round((elRect.top - parentRect.top) / getCanvasScale());
        }
      }

      dragOriginRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startTop,
        startLeft,
      };
      liveOffsetRef.current = { dx: 0, dy: 0 };
      setOptimisticPos(null);
      setIsDragging(true);
      // Selection follows the drag — feels natural in every editor.
      dispatch(selectNode({ node: node.entity }));
    },
    [canDragMove, t, dispatch, node.entity],
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
      const isAbs = t?.positionType === YGPT_ABSOLUTE;
      const top = Math.round(origin.startTop + offset.dy);
      const left = Math.round(origin.startLeft + offset.dx);

      // MOVE by splicing the source: absolute nodes get a new `position`; in-flow
      // nodes get a new `margin` (current margin + drag delta), staying responsive.
      const id = node.entity as unknown as number;
      if (isAbs) {
        setOptimisticPos({ top, left });
        void spliceUiTransformPosition(id, top, left);
      } else {
        const marginTop = Math.round(((t?.marginTop as number) ?? 0) + offset.dy);
        const marginLeft = Math.round(((t?.marginLeft as number) ?? 0) + offset.dx);
        setOptimisticPos({ marginTop, marginLeft });
        void spliceUiTransformMargin(id, marginTop, marginLeft);
      }
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
      liveOffsetRef.current = {
        dx: (e.clientX - origin.mouseX) / getCanvasScale(),
        dy: (e.clientY - origin.mouseY) / getCanvasScale(),
      };
      // Insertion index = number of sibling midpoints the cursor has passed
      // along the flow axis (comparison flips for *-reverse directions).
      const cursor = ro.axis === 'x' ? e.clientX : e.clientY;
      let index = 0;
      for (const s of ro.siblings) {
        const r = s.el.getBoundingClientRect();
        const mid = ro.axis === 'x' ? r.left + r.width / 2 : r.top + r.height / 2;
        if (ro.reversed ? cursor < mid : cursor > mid) index += 1;
      }
      ro.index = index;
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
      // No-op drops: no movement, or released over the slot it already holds.
      if ((offset.dx === 0 && offset.dy === 0) || ro.index === ro.selfIndex) return;
      const leftSibling = ro.index > 0 ? ro.siblings[ro.index - 1].entity : undefined;

      // Reorder by moving the element's source after the left sibling (or before
      // the first sibling when dropped at the head). The reparse reflows the node.
      const id = node.entity as unknown as number;
      if (leftSibling !== undefined) {
        void spliceMove(id, { kind: 'after', targetId: leftSibling as unknown as number });
      } else if (ro.siblings.length > 0) {
        void spliceMove(id, {
          kind: 'before',
          targetId: ro.siblings[0].entity as unknown as number,
        });
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isReordering, node.entity]);

  // Release the reorder hold once the committed rightOf matches the write.
  useEffect(() => {
    if (!pendingReorder) return;
    const rt = node.uiTransform as { rightOf?: number } | undefined;
    if ((rt?.rightOf ?? 0) !== pendingReorder.rightOf) return;
    setPendingReorder(null);
  }, [node, pendingReorder]);

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
    if (optimisticPos.marginTop !== undefined && num(t?.marginTop) !== optimisticPos.marginTop)
      return;
    if (optimisticPos.marginLeft !== undefined && num(t?.marginLeft) !== optimisticPos.marginLeft)
      return;
    setOptimisticPos(null);
  }, [node, optimisticPos]);

  // --- Resize handle interaction ---
  const handleResizeStart = useCallback(
    (dir: HandleDir) => (e: React.MouseEvent) => {
      if (!divRef.current) return;
      e.stopPropagation();
      e.preventDefault();
      const el = divRef.current;
      const parentEl = el.parentElement;
      if (!parentEl) return;
      // Read the rendered box from the DOM rather than the PB component —
      // works regardless of unit (%, px, auto) since getBoundingClientRect
      // returns post-layout viewport pixels which we convert with CANVAS_SCALE.
      const elRect = el.getBoundingClientRect();
      const parentRect = parentEl.getBoundingClientRect();
      resizeOriginRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startTop: (elRect.top - parentRect.top) / getCanvasScale(),
        startLeft: (elRect.left - parentRect.left) / getCanvasScale(),
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
    [dispatch, node.entity],
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMove = (e: MouseEvent) => {
      const origin = resizeOriginRef.current;
      if (!origin) return;
      const dxRaw = (e.clientX - origin.mouseX) / getCanvasScale();
      const dyRaw = (e.clientY - origin.mouseY) / getCanvasScale();
      const axes = HANDLE_AXES[origin.dir];

      // In-flow nodes can't move from a resize — the parent lays them out. Zero
      // the position axes so the live preview matches the commit (box grows in
      // place instead of following the top/left handles).
      const dxAxis = origin.isAbsolute ? axes.dx : 0;
      const dyAxis = origin.isAbsolute ? axes.dy : 0;

      // Snap the FINAL position/size, not the delta, so the grid is anchored
      // to absolute logical coords (consistent with move).
      const snap = (v: number) => Math.round(v / DRAG_SNAP_GRID) * DRAG_SNAP_GRID;
      const doSnap = !e.shiftKey;

      let nextLeft = origin.startLeft + dxRaw * dxAxis;
      let nextTop = origin.startTop + dyRaw * dyAxis;
      let nextW = origin.startW + dxRaw * axes.dw;
      let nextH = origin.startH + dyRaw * axes.dh;

      if (doSnap) {
        nextLeft = snap(nextLeft);
        nextTop = snap(nextTop);
        nextW = snap(nextW);
        nextH = snap(nextH);
      }
      // Don't allow negative sizes — clamp at 0.
      nextW = Math.max(0, nextW);
      nextH = Math.max(0, nextH);

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
      // Splice the new width/height into the .tsx source (top-level ergonomic
      // fields) and reparse. Position from top/left handles is a follow-up.
      if (!origin) return;
      if (live.dw === 0 && live.dh === 0) return;
      const width = Math.max(0, Math.round(origin.startW + live.dw));
      const height = Math.max(0, Math.round(origin.startH + live.dh));
      setOptimisticPos({ width, height });
      void spliceUiTransformSize(node.entity as unknown as number, width, height);
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
  const baseStyle = nodeStyle(node);
  const liveOffset =
    isDragging || isReordering
      ? liveOffsetRef.current
      : pendingReorder
        ? { dx: pendingReorder.dx, dy: pendingReorder.dy }
        : null;
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
    }
    if (optimisticPos.width !== undefined) style.width = `${optimisticPos.width}px`;
    if (optimisticPos.height !== undefined) style.height = `${optimisticPos.height}px`;
    // In-flow move hold: keep the node at its new margin (no positionType change).
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
        dragging: isDragging,
        reordering: isReordering,
        resizing: isResizing,
        movable: canDragMove,
      })}
      style={style}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
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
      {node.type === 'Label' && labelText ? (
        <span className="ui-designer-canvas-text">{labelText}</span>
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
            />
          ))
        : null}
      {isSelected && !isRoot ? <CanvasNodeActions entity={node.entity} /> : null}
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
const CanvasOpaqueNode: React.FC<{ node: CodeUINode }> = ({ node }) => {
  const dispatch = useAppDispatch();
  const isSelected = useAppSelector(state => getSelectedNode(state) === node.entity);
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
      style={nodeStyle(node)}
      onClick={e => {
        e.stopPropagation();
        dispatch(selectNode({ node: node.entity }));
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
  const labelText =
    node.type === 'Label'
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
      {node.type === 'Label' && labelText ? (
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
const CanvasComponentRefNode: React.FC<{ node: CodeUINode }> = ({ node }) => {
  const isSelected = useAppSelector(state => getSelectedNode(state) === node.entity);
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
      style={{ minWidth: 80, minHeight: 40, width: '100%', height: '100%', ...nodeStyle(node) }}
      data-type="component-ref"
      data-entity={String(node.entity)}
      title={`<${name} /> — a nested UI component. Edit it by opening "${name}".`}
    >
      {resolved ? (
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
  const cn = node as CodeUINode;
  if (cn.componentRef) return <CanvasComponentRefNode node={cn} />;
  if (cn.opaque) return <CanvasOpaqueNode node={cn} />;
  return <CanvasNode node={node} />;
};

const CanvasComponent: React.FC = () => {
  const tree = useUINodeTree();
  // Resolve `state.<var>` → its default value for the text preview (built once
  // here; every CanvasNode reads it via VarPreviewContext).
  const { bindingSurface } = useCodeState();
  const resolveVar = useMemo(() => {
    const map = buildResolveMap(bindingSurface.variables);
    return (expr: string) => map[expr];
  }, [bindingSurface]);
  // Code-mode roots are files under src/ui/ (see code/store), not ECS entities.
  const createRoot = useCallback(() => void createCodeRoot(), []);
  const selectedNode = useAppSelector(getSelectedNode);
  const [scale, setScale] = useState(getCanvasScale());
  const [device, setDevice] = useState<DeviceKind>('desktop');
  const [showSafeAreas, setShowSafeAreas] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  // When a node is selected from elsewhere (tree / roots list) and it sits
  // fully outside the viewport, scroll it into view. We only act when it's
  // entirely off-screen so clicking an already-visible node on the canvas never
  // makes the view jump.
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
      vp.scrollLeft += er.left + er.width / 2 - (vr.left + vr.width / 2);
      vp.scrollTop += er.top + er.height / 2 - (vr.top + vr.height / 2);
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
  // measure.ts) in sync with the rendered zoom.
  useEffect(() => {
    setCanvasScale(scale);
  }, [scale]);

  // Defensive: drop any stale entity→element entries when the canvas unmounts
  // (e.g. switching scenes). Individual node unmounts already unregister via
  // `setRef`; this guards against an entry surviving a full canvas teardown.
  useEffect(() => () => clearNodeRegistry(), []);

  // Ctrl/⌘ + wheel to zoom. Native non-passive listener so we can preventDefault
  // (otherwise the browser page-zooms). Attached to the always-mounted viewport.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setScale(s => clampZoom(s - e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <VarPreviewContext.Provider value={resolveVar}>
      <div
        ref={viewportRef}
        className="ui-designer-canvas-viewport"
      >
        {tree ? (
          <>
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
                onClick={() => setScale(DEFAULT_CANVAS_SCALE)}
                title="Reset zoom"
                aria-label="Reset zoom"
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
                onClick={() => setDevice('desktop')}
                title="Desktop preview"
                aria-label="Desktop preview"
                aria-pressed={device === 'desktop'}
              >
                <IoDesktopOutline />
              </button>
              <button
                type="button"
                className={cx('ui-designer-canvas-zoom-btn', { active: device === 'mobile' })}
                onClick={() => setDevice('mobile')}
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
            {device === 'desktop' ? (
              <div
                className="ui-designer-canvas-stage"
                style={{ width: canvasWidth * scale, height: canvasHeight * scale }}
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
                  {/* UI scaled-to-fit + letterboxed, inspection-only (no editing). */}
                  <div
                    className="ui-designer-canvas-root preview-only"
                    style={{
                      width: canvasWidth,
                      height: canvasHeight,
                      transform: `scale(${fitScale})`,
                      transformOrigin: 'top left',
                      position: 'absolute',
                      left: (MOBILE_REFERENCE.width - canvasWidth * fitScale) / 2,
                      top: (MOBILE_REFERENCE.height - canvasHeight * fitScale) / 2,
                      pointerEvents: 'none',
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
        ) : (
          <div className="ui-designer-canvas-empty">
            <EmptyState
              icon={<IoLayersOutline />}
              title="No UI yet"
              message="Create a UI to start designing your scene's interface, then drag widgets from the palette below."
              action={<Button onClick={createRoot}>+ New UI</Button>}
            />
          </div>
        )}
      </div>
    </VarPreviewContext.Provider>
  );
};

export const Canvas = React.memo(CanvasComponent);

export default Canvas;
