import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDrop } from 'react-dnd';
import cx from 'classnames';
import type { PBUiTransform } from '@dcl/ecs';

import { useSdk } from '../../hooks/sdk/useSdk';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { getSelectedNode, getTool, selectNode } from '../../redux/ui-designer';
import { UI_DESIGNER_DND_TYPE, type UIDesignerDragItem } from './Palette';
import { useUINodeTree } from './useUINodeTree';
import type { UINode } from './tree-model';

// Logical canvas is 1920×1080; visual scale is 0.4 (see Canvas.css
// `.ui-designer-canvas-root`). Keep this in sync if the CSS scale changes.
export const CANVAS_SCALE = 0.4;

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

// PB enums are exported as `const enum`s; importing them at runtime is risky
// across module boundaries (they're erased at compile time and dist may not
// preserve them). We hard-code the numeric values here with comments — the
// mappings are stable wire-format constants defined in
// node_modules/@dcl/ecs/dist/components/generated/pb/decentraland/sdk/components/ui_transform.gen.d.ts
// and common/texts.gen.d.ts.

// YGUnit
const YGU_UNDEFINED = 0;
const YGU_POINT = 1;
const YGU_PERCENT = 2;
const YGU_AUTO = 3;

// YGDisplay
const YGD_NONE = 1;

// YGPositionType
const YGPT_ABSOLUTE = 1;

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
// single 9-value enum; CSS text-align is horizontal only. V1: project to the
// horizontal axis and ignore the vertical component.
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
  };

  // Yoga's defaults differ from CSS flexbox in two important ways. Apply Yoga's
  // values up-front so the canvas preview matches in-world rendering:
  //   - flexDirection: Yoga defaults to COLUMN, CSS defaults to ROW.
  //   - flexShrink:    Yoga defaults to 0,     CSS defaults to 1.
  const style: React.CSSProperties = {
    display: t.display === YGD_NONE ? 'none' : 'flex',
    position: t.positionType === YGPT_ABSOLUTE ? 'absolute' : 'relative',
    flexDirection: 'column',
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
  const bt = (node.uiTransform ?? {}) as Record<string, any>;
  applyBorder('Top', 'borderTopWidth', 'borderTopWidthUnit', bt.borderTopColor);
  applyBorder('Right', 'borderRightWidth', 'borderRightWidthUnit', bt.borderRightColor);
  applyBorder('Bottom', 'borderBottomWidth', 'borderBottomWidthUnit', bt.borderBottomColor);
  applyBorder('Left', 'borderLeftWidth', 'borderLeftWidthUnit', bt.borderLeftColor);

  if (b?.color) {
    style.backgroundColor = color4ToRgba(b.color);
  }
  if (text?.color) {
    style.color = color4ToRgba(text.color);
  }
  if (text?.fontSize !== undefined) {
    style.fontSize = `${text.fontSize}px`;
  }
  if (text?.textAlign !== undefined && TEXT_ALIGN_H[text.textAlign]) {
    style.textAlign = TEXT_ALIGN_H[text.textAlign];
  }
  return style;
}

type CanvasNodeProps = { node: UINode };

const CanvasNode: React.FC<CanvasNodeProps> = ({ node }) => {
  const sdk = useSdk();
  const dispatch = useAppDispatch();
  const selectedNode = useAppSelector(getSelectedNode);
  const tool = useAppSelector(getTool);
  const isSelected = selectedNode === node.entity;
  const text = (node.uiText ?? {}) as { value?: string };
  const input = (node.uiInput ?? {}) as { placeholder?: string; value?: string };
  const dropdown = (node.uiDropdown ?? {}) as {
    options?: string[];
    selectedIndex?: number;
    emptyLabel?: string;
  };

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
        if (!sdk) return;
        if (monitor.didDrop()) return;
        if (item.source !== 'palette') return;

        // Translate the drop's viewport offset to logical-pixel coordinates
        // local to this node. The canvas root is scaled by CANVAS_SCALE; the
        // div's getBoundingClientRect already reflects the post-transform
        // box, so dividing by the scale recovers logical (Yoga) pixels.
        const clientOffset = monitor.getClientOffset();
        const rect = divRef.current?.getBoundingClientRect();
        let localX = 0;
        let localY = 0;
        if (clientOffset && rect) {
          localX = Math.round((clientOffset.x - rect.left) / CANVAS_SCALE);
          localY = Math.round((clientOffset.y - rect.top) / CANVAS_SCALE);
        }
        const newEntity = sdk.operations.addUINode(node.entity, item.type);
        // Default behaviour: absolutely positioned at the drop point. Users
        // can flip `positionType` to `relative` in the property panel for
        // flex flow.
        const UiTransform = sdk.components.UiTransform;
        const current = (UiTransform.getOrNull(newEntity) ?? {}) as PBUiTransform;
        UiTransform.createOrReplace(newEntity, {
          ...current,
          positionType: 1, // YGPositionType.YGPT_ABSOLUTE
          positionTop: localY,
          positionTopUnit: 1, // YGUnit.YGU_POINT
          positionLeft: localX,
          positionLeftUnit: 1, // YGUnit.YGU_POINT
        } as unknown as PBUiTransform);
        // Await the dispatch so the engine flushes the new entity's components
        // before we trigger any tree re-derive. Without this the NodeTree
        // walker runs against a stale snapshot and the new child only appears
        // after the next unrelated change fires `useChange`.
        await sdk.operations.dispatch();
        dispatch(selectNode({ node: newEntity }));
      },
    }),
    [sdk, node.entity, dispatch],
  );

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      divRef.current = el;
      drop(el);
    },
    [drop],
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

  // --- Resize-tool state ---
  const resizeOriginRef = useRef<{
    mouseX: number;
    mouseY: number;
    startTop: number;
    startLeft: number;
    startW: number;
    startH: number;
    dir: HandleDir;
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

      // If the node is currently in flex flow, anchor its starting position
      // at where it was just rendered (relative to its parent). The mouseup
      // path will write positionType=ABSOLUTE plus these coords, effectively
      // converting the node into a free-positioned child.
      let startTop = (t?.positionTop ?? 0) as number;
      let startLeft = (t?.positionLeft ?? 0) as number;
      const isAbsolute = t?.positionType === 1;
      if (!isAbsolute) {
        const el = divRef.current;
        const parentEl = el?.parentElement;
        if (el && parentEl) {
          const elRect = el.getBoundingClientRect();
          const parentRect = parentEl.getBoundingClientRect();
          startLeft = Math.round((elRect.left - parentRect.left) / CANVAS_SCALE);
          startTop = Math.round((elRect.top - parentRect.top) / CANVAS_SCALE);
        }
      }

      dragOriginRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startTop,
        startLeft,
      };
      liveOffsetRef.current = { dx: 0, dy: 0 };
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
      let dxLogical = (e.clientX - origin.mouseX) / CANVAS_SCALE;
      let dyLogical = (e.clientY - origin.mouseY) / CANVAS_SCALE;
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
      setRenderTick(tick => (tick + 1) & 0x7fffffff);
    };

    const handleUp = () => {
      const origin = dragOriginRef.current;
      const offset = liveOffsetRef.current;
      dragOriginRef.current = null;
      liveOffsetRef.current = { dx: 0, dy: 0 };
      setIsDragging(false);

      if (!sdk || !origin) return;
      if (offset.dx === 0 && offset.dy === 0) return;
      const UiTransform = sdk.components.UiTransform;
      const current = (UiTransform.getOrNull(node.entity) ?? {}) as PBUiTransform;
      UiTransform.createOrReplace(node.entity, {
        ...current,
        positionType: 1, // ABSOLUTE
        positionTop: Math.round(origin.startTop + offset.dy),
        positionTopUnit: 1,
        positionLeft: Math.round(origin.startLeft + offset.dx),
        positionLeftUnit: 1,
      } as unknown as PBUiTransform);
      void sdk.operations.dispatch();
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, sdk, node.entity]);

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
        startTop: (elRect.top - parentRect.top) / CANVAS_SCALE,
        startLeft: (elRect.left - parentRect.left) / CANVAS_SCALE,
        startW: elRect.width / CANVAS_SCALE,
        startH: elRect.height / CANVAS_SCALE,
        dir,
      };
      resizeLiveRef.current = { dx: 0, dy: 0, dw: 0, dh: 0 };
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
      const dxRaw = (e.clientX - origin.mouseX) / CANVAS_SCALE;
      const dyRaw = (e.clientY - origin.mouseY) / CANVAS_SCALE;
      const axes = HANDLE_AXES[origin.dir];

      // Snap the FINAL position/size, not the delta, so the grid is anchored
      // to absolute logical coords (consistent with move).
      const snap = (v: number) => Math.round(v / DRAG_SNAP_GRID) * DRAG_SNAP_GRID;
      const doSnap = !e.shiftKey;

      let nextLeft = origin.startLeft + dxRaw * axes.dx;
      let nextTop = origin.startTop + dyRaw * axes.dy;
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
      setRenderTick(tick => (tick + 1) & 0x7fffffff);
    };

    const handleUp = () => {
      const origin = resizeOriginRef.current;
      const live = resizeLiveRef.current;
      resizeOriginRef.current = null;
      resizeLiveRef.current = { dx: 0, dy: 0, dw: 0, dh: 0 };
      setIsResizing(false);
      if (!sdk || !origin) return;
      if (live.dx === 0 && live.dy === 0 && live.dw === 0 && live.dh === 0) return;
      const UiTransform = sdk.components.UiTransform;
      const current = (UiTransform.getOrNull(node.entity) ?? {}) as PBUiTransform;
      // Resizing forces the node to absolute positioning + px units. Trying to
      // resize a %-sized node in-place would require ambient knowledge of the
      // parent's current size; flattening to px is the predictable choice.
      UiTransform.createOrReplace(node.entity, {
        ...current,
        positionType: 1,
        positionTop: Math.round(origin.startTop + live.dy),
        positionTopUnit: 1,
        positionLeft: Math.round(origin.startLeft + live.dx),
        positionLeftUnit: 1,
        width: Math.max(0, Math.round(origin.startW + live.dw)),
        widthUnit: 1,
        height: Math.max(0, Math.round(origin.startH + live.dh)),
        heightUnit: 1,
      } as unknown as PBUiTransform);
      void sdk.operations.dispatch();
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing, sdk, node.entity]);

  // Apply the live drag offset visually via CSS transform so we don't write
  // to the CRDT/data-layer until the user releases the mouse.
  const baseStyle = nodeStyle(node);
  const liveOffset = isDragging ? liveOffsetRef.current : null;
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

  return (
    <div
      ref={setRef}
      className={cx('ui-designer-canvas-node', {
        selected: isSelected,
        'drop-over': isOver,
        dragging: isDragging,
        resizing: isResizing,
        movable: canDragMove,
      })}
      style={style}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      data-entity={String(node.entity)}
      data-type={node.type}
    >
      {node.type === 'Input' && (
        <span className="ui-designer-canvas-input">
          {input.value || input.placeholder || 'Input'}
        </span>
      )}
      {node.type === 'Dropdown' && (
        <span className="ui-designer-canvas-dropdown">
          <span className="ui-designer-canvas-dropdown-label">
            {dropdown.options?.[dropdown.selectedIndex ?? 0] ?? dropdown.emptyLabel ?? 'Select…'}
          </span>
          <span className="ui-designer-canvas-dropdown-chevron">▼</span>
        </span>
      )}
      {(node.type === 'Label' || node.type === 'Button') && text?.value && (
        <span className="ui-designer-canvas-text">{text.value}</span>
      )}
      {node.type === 'Button' && !text?.value && (
        <span className="ui-designer-canvas-text ui-designer-canvas-placeholder">Button</span>
      )}
      {node.children.map(child => (
        <CanvasNode
          key={String(child.entity)}
          node={child}
        />
      ))}
      {showResizeHandles &&
        HANDLE_DIRS.map(dir => (
          <span
            key={dir}
            className={cx('ui-designer-resize-handle', dir)}
            onMouseDown={handleResizeStart(dir)}
          />
        ))}
    </div>
  );
};

const CanvasComponent: React.FC = () => {
  const tree = useUINodeTree();
  if (!tree) {
    return (
      <div className="ui-designer-canvas-empty">
        <p>No UI selected. Create one from the left rail.</p>
      </div>
    );
  }
  return (
    <div className="ui-designer-canvas-viewport">
      <div className="ui-designer-canvas-root">
        <CanvasNode node={tree} />
      </div>
    </div>
  );
};

export const Canvas = React.memo(CanvasComponent);

export default Canvas;
