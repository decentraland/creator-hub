import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { useDrop } from 'react-dnd';
import { useStore } from 'react-redux';
import {
  IoAddOutline,
  IoCopyOutline,
  IoDesktopOutline,
  IoPhoneLandscapeOutline,
  IoScanOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import cx from 'classnames';
import type { Entity, PBUiTransform } from '@dcl/ecs';

import { useAssetUrl } from '../../../hooks/useAssetUrl';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import type { RootState } from '../../../redux/store';
import {
  getAspectLockedNodes,
  getHiddenNodes,
  getInteractionLayer,
  getLockedNodes,
  getPlatform,
  getScreens,
  getSelectedNode,
  getSelectedNodes,
  selectNode,
  setPlatform,
  toggleNodeSelection,
} from '../../../redux/ui-designer';
import { getUIDesignerSnapEnabled, getUIDesignerTool } from '../../../redux/ui';
import { UIDesignerTool } from '../../../redux/ui/types';
import { Button } from '../../Button';
import { YGPT_ABSOLUTE, YGPT_RELATIVE, YGU_POINT } from '../../../lib/sdk/ui-transform-constants';
import { UI_DESIGNER_DND_TYPE, type UIDesignerDragItem } from '../shared/dnd';
import { EmptyState, EmptyStateChip, GuiIcon } from '../EmptyState';
import { WidgetPicker } from '../LeftPanel/WidgetPicker';
import type { UiScreenInset } from '../code/aggregator';
import { dragPinHold } from '../shared/align-presets';
import {
  DEFAULT_CANVAS_SCALE,
  getCanvasScale,
  offsetInParent,
  setCanvasScale,
} from '../shared/measure';
import { insetRect } from '../shared/safe-areas';
import { useUINodeActions } from '../shared/useUINodeActions';
import { useUINodeTree } from '../shared/useUINodeTree';
import {
  createRoot as createCodeRoot,
  spliceMove,
  spliceSetRootChild,
  spliceUiTransformPosition,
  spliceUiTransformPositions,
  spliceUiTransformResize,
  useCodeState,
} from '../code/store';
import type { MoveAnchor } from '../code/store';
import { buildResolveMap } from '../code/bindings';
import { previewLayers, resolveInteractionPreview } from '../code/interaction-preview';
import type { CodeUINode } from '../code/types';
import { MixedContentField } from '../RightPanel/PropertyPanel/MixedContentField';
import { seedSegments } from '../RightPanel/PropertyPanel/MixedContentField/segments';
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  previewBoundText,
} from '../shared/tree-model';
import {
  clearNodeRegistry,
  getNodeElement,
  registerNodeElement,
  unregisterNodeElement,
} from '../shared/node-registry';
import { applyCanvasDrop } from './drop';
import {
  armGroupClickSuppression,
  clearGroupDrag,
  commitGroupDrag,
  consumeGroupClickSuppression,
  groupCommitFor,
  groupLiveOffsetFor,
  moveGroupDrag,
  resetGroupClickSuppression,
  startGroupDrag,
  subscribeGroupDrag,
} from './group-drag';
import type { Box, Flow, InsertionSlot } from './reorder';
import { flowFrom, insertionSlot } from './reorder';
import { hiddenStyle, nodeStyle, rendersText, TEXT_VALUE_FIELD, textureStyle } from './node-style';
import { renderTextMarkup } from './text-markup';
import { SafeAreaOverlay } from './SafeAreaOverlay';

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;
const clampZoom = (s: number): number =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(s * 100) / 100));

const DRAG_SNAP_GRID = 10;

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

const VarPreviewContext = React.createContext<(expr: string) => string | undefined>(
  () => undefined,
);

type ReorderDrag = {
  parentEl: HTMLElement;
  parentBox: Box;
  flow: Flow;
  siblings: { entity: Entity; box: Box }[];
  center: { x: number; y: number };
  selfIndex: number;
  slot: InsertionSlot;
};

const toBox = (r: DOMRect): Box => ({
  left: r.left,
  top: r.top,
  right: r.right,
  bottom: r.bottom,
});

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

type CanvasNodeProps = { node: CodeUINode; hidden?: boolean };

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
  const isSelected = useAppSelector(state => getSelectedNodes(state).includes(node.entity));
  const isLocked = useAppSelector(
    state => !!getLockedNodes(state)[node.entity as unknown as number],
  );
  const reduxStore = useStore<RootState>();
  const groupLive = useSyncExternalStore(subscribeGroupDrag, () =>
    groupLiveOffsetFor(node.entity as unknown as number),
  );
  const aspectLocked = useAppSelector(
    state => !!getAspectLockedNodes(state)[node.entity as unknown as number],
  );
  const aspectLockedRef = useRef(aspectLocked);
  useEffect(() => {
    aspectLockedRef.current = aspectLocked;
  }, [aspectLocked]);
  const snapEnabled = useAppSelector(getUIDesignerSnapEnabled);
  const snapEnabledRef = useRef(snapEnabled);
  useEffect(() => {
    snapEnabledRef.current = snapEnabled;
  }, [snapEnabled]);

  const [canvasHovered, setCanvasHovered] = useState(false);
  const panelLayer = useAppSelector(getInteractionLayer);
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

  const background = (previewNode.uiBackground ?? {}) as {
    texture?: { tex?: { $case: string; texture?: { src?: string } } };
    textureMode?: number;
    uvs?: number[];
  };
  const tex = background.texture?.tex;
  const texSrc = tex?.$case === 'texture' ? tex.texture?.src : undefined;
  const texUrl = useAssetUrl(texSrc);

  const divRef = useRef<HTMLDivElement | null>(null);

  const [{ isOver }, drop] = useDrop<UIDesignerDragItem, unknown, { isOver: boolean }>(
    () => ({
      accept: UI_DESIGNER_DND_TYPE,
      collect: monitor => ({ isOver: monitor.isOver({ shallow: true }) }),
      drop: (item, monitor) => {
        if (monitor.didDrop()) return;
        const p = monitor.getClientOffset();
        const r = divRef.current?.getBoundingClientRect();
        const pos =
          p && r
            ? {
                top: Math.round((p.y - r.top) / getCanvasScale()),
                left: Math.round((p.x - r.left) / getCanvasScale()),
              }
            : undefined;
        applyCanvasDrop(item, node.entity as unknown as number, pos);
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

  const t = (node.uiTransform ?? null) as PBUiTransform | null;
  const isRoot = !t?.parent;
  const tool = useAppSelector(getUIDesignerTool);
  const canDragMove =
    !isRoot && !isLocked && (tool === UIDesignerTool.FREE || tool === UIDesignerTool.MOVE);
  const showResizeHandles =
    !isRoot &&
    isSelected &&
    !isLocked &&
    (tool === UIDesignerTool.FREE || tool === UIDesignerTool.RESIZE);

  const [isGroupDragging, setIsGroupDragging] = useState(false);
  const groupOriginsRef = useRef<Map<number, { top: number; left: number }> | null>(null);
  const groupDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const dragOriginRef = useRef<{
    mouseX: number;
    mouseY: number;
    startTop: number;
    startLeft: number;
  } | null>(null);
  const liveOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [, setRenderTick] = useState(0);
  const [optimisticPos, setOptimisticPos] = useState<{
    top?: number;
    left?: number;
    width?: number;
    height?: number;
    marginTop?: number;
    marginLeft?: number;
  } | null>(null);

  const reorderRef = useRef<ReorderDrag | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [heldOffset, setHeldOffset] = useState<{ dx: number; dy: number } | null>(null);

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

  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  editingRef.current = editing;
  const isTextEditable = !isLocked && rendersText(node.type);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (consumeGroupClickSuppression()) {
        e.stopPropagation();
        return;
      }
      if (isLocked) return;
      e.stopPropagation();
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
      if (e.button !== 0) return;
      resetGroupClickSuppression();
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (isLocked) return;
      if (!canDragMove) return;
      if (editingRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, input, select, textarea')) return;

      e.stopPropagation();
      e.preventDefault();

      const isAbsolute = t?.positionType === YGPT_ABSOLUTE;

      if (isAbsolute) {
        const st = reduxStore.getState();
        const selected = getSelectedNodes(st).map(Number);
        if (selected.length > 1 && selected.includes(Number(node.entity))) {
          const locked = getLockedNodes(st);
          const participants = selected.filter(id => {
            if (locked[id]) return false;
            const pel = getNodeElement(id as unknown as Entity);
            return !!pel && getComputedStyle(pel).position === 'absolute';
          });
          if (participants.length > 1) {
            const origins = new Map<number, { top: number; left: number }>();
            for (const id of participants) {
              const pel = getNodeElement(id as unknown as Entity);
              const parent = pel?.parentElement;
              origins.set(id, pel && parent ? offsetInParent(pel, parent) : { top: 0, left: 0 });
            }
            const self = origins.get(Number(node.entity)) ?? { top: 0, left: 0 };
            dragOriginRef.current = {
              mouseX: e.clientX,
              mouseY: e.clientY,
              startTop: self.top,
              startLeft: self.left,
            };
            groupOriginsRef.current = origins;
            groupDeltaRef.current = { dx: 0, dy: 0 };
            setOptimisticPos(null);
            setHeldOffset(null);
            startGroupDrag(participants);
            setIsGroupDragging(true);
            return;
          }
        }
      }

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
      dispatch(selectNode({ node: node.entity }));
      if (isAbsolute) {
        setIsDragging(true);
        return;
      }
      reorderRef.current = divRef.current ? captureReorderDrag(divRef.current) : null;
      if (reorderRef.current) setIsReordering(true);
    },
    [canDragMove, t, dispatch, node.entity, isLocked, reduxStore],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent) => {
      const origin = dragOriginRef.current;
      if (!origin) return;
      let dxLogical = (e.clientX - origin.mouseX) / getCanvasScale();
      let dyLogical = (e.clientY - origin.mouseY) / getCanvasScale();
      if (snapEnabledRef.current && !e.shiftKey) {
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

  useEffect(
    () =>
      subscribeGroupDrag(() => {
        const c = groupCommitFor(node.entity as unknown as number);
        if (c) setOptimisticPos({ top: c.top, left: c.left });
      }),
    [node.entity],
  );

  useEffect(() => {
    if (!isGroupDragging) return;

    const handleMove = (e: MouseEvent) => {
      const origin = dragOriginRef.current;
      if (!origin) return;
      armGroupClickSuppression();
      let dx = (e.clientX - origin.mouseX) / getCanvasScale();
      let dy = (e.clientY - origin.mouseY) / getCanvasScale();
      if (snapEnabledRef.current && !e.shiftKey) {
        const snappedLeft = Math.round((origin.startLeft + dx) / DRAG_SNAP_GRID) * DRAG_SNAP_GRID;
        const snappedTop = Math.round((origin.startTop + dy) / DRAG_SNAP_GRID) * DRAG_SNAP_GRID;
        dx = snappedLeft - origin.startLeft;
        dy = snappedTop - origin.startTop;
      }
      groupDeltaRef.current = { dx, dy };
      moveGroupDrag(dx, dy);
    };

    const handleUp = () => {
      const origins = groupOriginsRef.current;
      const { dx, dy } = groupDeltaRef.current;
      dragOriginRef.current = null;
      groupOriginsRef.current = null;
      setIsGroupDragging(false);
      if (!origins || (dx === 0 && dy === 0)) {
        clearGroupDrag();
        return;
      }
      const moves: { entityId: number; top: number; left: number }[] = [];
      const commit = new Map<number, { top: number; left: number }>();
      for (const [entityId, o] of origins) {
        const top = Math.round(o.top + dy);
        const left = Math.round(o.left + dx);
        moves.push({ entityId, top, left });
        commit.set(entityId, { top, left });
      }
      commitGroupDrag(commit);
      void spliceUiTransformPositions(moves).finally(() => clearGroupDrag());
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isGroupDragging]);

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
      if ((offset.dx === 0 && offset.dy === 0) || ro.slot.index === ro.selfIndex) return;
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

  useEffect(() => {
    setHeldOffset(held => (held ? null : held));
  }, [node]);

  useEffect(() => {
    if (!optimisticPos) return;
    const t = node.uiTransform as PBUiTransform | undefined;
    const num = (v: unknown) => Math.round((v as number | undefined) ?? NaN);
    if (optimisticPos.top !== undefined && num(t?.positionTop) !== optimisticPos.top) return;
    if (optimisticPos.left !== undefined && num(t?.positionLeft) !== optimisticPos.left) return;
    if (optimisticPos.width !== undefined && num(t?.width) !== optimisticPos.width) return;
    if (optimisticPos.height !== undefined && num(t?.height) !== optimisticPos.height) return;
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

  const handleResizeStart = useCallback(
    (dir: HandleDir) => (e: React.MouseEvent) => {
      if (isLocked || !divRef.current) return;
      e.stopPropagation();
      e.preventDefault();
      const el = divRef.current;
      const parentEl = el.parentElement;
      if (!parentEl) return;
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

      const snap = (v: number) => Math.round(v / DRAG_SNAP_GRID) * DRAG_SNAP_GRID;
      const doSnap = snapEnabledRef.current && !e.shiftKey;

      let nextW = origin.startW + dxRaw * axes.dw;
      let nextH = origin.startH + dyRaw * axes.dh;

      if (doSnap) {
        nextW = snap(nextW);
        nextH = snap(nextH);
      }
      nextW = Math.max(0, nextW);
      nextH = Math.max(0, nextH);

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
      const width = Math.max(0, Math.round(origin.startW + live.dw));
      const height = Math.max(0, Math.round(origin.startH + live.dh));
      const id = node.entity as unknown as number;
      const hasMove = live.dx !== 0 || live.dy !== 0;
      if (origin.isAbsolute) {
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

  const baseStyle = nodeStyle(previewNode);
  const liveOffset = isDragging || isReordering ? liveOffsetRef.current : (groupLive ?? heldOffset);
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

  if (optimisticPos && !isDragging && !isResizing && !groupLive) {
    style = { ...style };
    if (optimisticPos.top !== undefined && optimisticPos.left !== undefined) {
      style.position = 'absolute';
      style.top = `${optimisticPos.top}px`;
      style.left = `${optimisticPos.left}px`;
      style.right = undefined;
      style.bottom = undefined;
    }
    if (optimisticPos.width !== undefined) style.width = `${optimisticPos.width}px`;
    if (optimisticPos.height !== undefined) style.height = `${optimisticPos.height}px`;
    if (optimisticPos.marginTop !== undefined) style.marginTop = `${optimisticPos.marginTop}px`;
    if (optimisticPos.marginLeft !== undefined) style.marginLeft = `${optimisticPos.marginLeft}px`;
  }

  if (texUrl) {
    style = { ...style, ...textureStyle(texUrl, background.textureMode, background.uvs) };
  }

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
          <span className="ui-designer-canvas-text">{renderTextMarkup(labelText)}</span>
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
              onContextMenu={e => e.preventDefault()}
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

const CanvasReadonlyNode: React.FC<{
  node: CodeUINode;
  resolveMap: Record<string, string>;
  isRoot?: boolean;
}> = ({ node, resolveMap, isRoot }) => {
  const resolve = useCallback((expr: string) => resolveMap[expr], [resolveMap]);
  let style = nodeStyle(node);
  if (isRoot) {
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
        <span className="ui-designer-canvas-text">{renderTextMarkup(labelText)}</span>
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

const CanvasNodeView: React.FC<CanvasNodeProps> = ({ node }) => {
  const isNodeHidden = useAppSelector(
    state => !!getHiddenNodes(state)[node.entity as unknown as number],
  );
  const platform = useAppSelector(getPlatform);
  const cn = node as CodeUINode;
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
  const { bindingSurface, emptyRoot, roots, filename } = useCodeState();
  const resolveVar = useMemo(() => {
    const map = buildResolveMap(bindingSurface.variables);
    return (expr: string) => map[expr];
  }, [bindingSurface]);
  const createRoot = useCallback(() => void createCodeRoot(), []);
  const selectedNode = useAppSelector(getSelectedNode);
  const [scale, setScale] = useState(getCanvasScale());
  const dispatch = useAppDispatch();
  const device = useAppSelector(getPlatform);
  const screen = useAppSelector(getScreens)[device];
  const activeRoot = roots.find(r => r.filename === filename);
  const activeInset: UiScreenInset = activeRoot?.topLevel ? activeRoot.screenInset : 'none';
  const [showSafeAreas, setShowSafeAreas] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panDragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(
    null,
  );
  const [isPanning, setIsPanning] = useState(false);

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

  const rootT = (tree?.uiTransform ?? {}) as Record<string, number | undefined>;
  const rootFixedW = rootT.widthUnit === YGU_POINT ? rootT.width : undefined;
  const rootFixedH = rootT.heightUnit === YGU_POINT ? rootT.height : undefined;
  const fixedRoot = rootFixedW !== undefined && rootFixedH !== undefined;

  const canvasWidth = fixedRoot ? (rootFixedW as number) : DEFAULT_CANVAS_WIDTH;
  const canvasHeight = fixedRoot ? (rootFixedH as number) : DEFAULT_CANVAS_HEIGHT;

  const frameWidth = fixedRoot ? canvasWidth : screen.width;
  const frameHeight = fixedRoot ? canvasHeight : screen.height;

  const fitScale = fixedRoot ? 1 : Math.min(frameWidth / canvasWidth, frameHeight / canvasHeight);

  const insetLocked = activeInset !== 'none' && !fixedRoot;
  const safeAreasVisible = insetLocked || showSafeAreas;
  const overlayVariant = activeInset === 'device' ? 'device' : 'hud';

  const insetR = insetLocked ? insetRect(device, activeInset) : null;
  const fsLeft = (frameWidth - canvasWidth * fitScale) / 2;
  const fsTop = (frameHeight - canvasHeight * fitScale) / 2;
  const fsRight = fsLeft + canvasWidth * fitScale;
  const fsBottom = fsTop + canvasHeight * fitScale;
  const rootClip = insetR
    ? {
        left: Math.max(fsLeft, insetR.x[0] * frameWidth),
        top: Math.max(fsTop, insetR.y[0] * frameHeight),
        right: Math.min(fsRight, insetR.x[1] * frameWidth),
        bottom: Math.min(fsBottom, insetR.y[1] * frameHeight),
      }
    : { left: fsLeft, top: fsTop, right: fsRight, bottom: fsBottom };
  const rootStyle: React.CSSProperties = {
    width: (rootClip.right - rootClip.left) / fitScale,
    height: (rootClip.bottom - rootClip.top) / fitScale,
    transform: `scale(${fitScale})`,
    transformOrigin: 'top left',
    position: 'absolute',
    left: rootClip.left,
    top: rootClip.top,
  };

  useEffect(() => {
    setCanvasScale(scale * fitScale);
  }, [scale, fitScale]);

  useEffect(() => () => clearNodeRegistry(), []);

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
              <div
                className={cx('ui-designer-canvas-stage', {
                  'ui-designer-device-frame': device === 'mobile',
                })}
                style={{
                  width: frameWidth * scale,
                  height: frameHeight * scale,
                  transform: `translate(${pan.x}px, ${pan.y}px)`,
                }}
              >
                <div
                  className="ui-designer-canvas-screen"
                  style={
                    {
                      width: frameWidth,
                      height: frameHeight,
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left',
                      '--uid-scale': scale * fitScale,
                      '--uid-screen-scale': scale,
                    } as React.CSSProperties
                  }
                >
                  <div
                    className="ui-designer-canvas-root"
                    style={rootStyle}
                  >
                    <CanvasNodeView node={tree} />
                  </div>
                  {safeAreasVisible && !fixedRoot ? (
                    <SafeAreaOverlay
                      width={screen.width}
                      height={screen.height}
                      device={device}
                      variant={overlayVariant}
                    />
                  ) : null}
                </div>
              </div>
            </>
          ) : emptyRoot ? (
            <EmptyRootDropZone />
          ) : (
            <div className="ui-designer-canvas-empty">
              <EmptyState
                icon={<GuiIcon />}
                title="Start building your UI"
                message={
                  <>
                    Click the <EmptyStateChip>GUIs +</EmptyStateChip> button in the left panel to
                    add UI elements. Then, select elements such as{' '}
                    <strong>text, buttons, and images</strong> from the{' '}
                    <EmptyStateChip>Nodes</EmptyStateChip> section to design what players will see
                    in your scene.
                  </>
                }
                action={
                  <Button onClick={createRoot}>
                    <IoAddOutline aria-hidden="true" />
                    New GUI
                  </Button>
                }
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
              className={cx('ui-designer-canvas-zoom-btn', {
                active: safeAreasVisible,
                locked: insetLocked,
              })}
              onClick={() => {
                if (!insetLocked) setShowSafeAreas(s => !s);
              }}
              disabled={insetLocked}
              title={
                insetLocked
                  ? 'Safe-area guides follow the Scene Inset — change it to unlock'
                  : 'Toggle safe-area guides'
              }
              aria-label="Toggle safe-area guides"
              aria-pressed={safeAreasVisible}
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
