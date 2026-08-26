import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IoEyeOutline as VisibleIcon,
  IoEyeOffOutline as InvisibleIcon,
  IoAddOutline,
  IoDesktopOutline,
  IoPhoneLandscapeOutline,
  IoSwapHorizontalOutline,
  IoWarningOutline,
  IoCubeOutline,
  IoTrashOutline as RemoveIcon,
} from 'react-icons/io5';
import { MdOutlineLock as LockIcon, MdOutlineLockOpen as UnlockIcon } from 'react-icons/md';
import cx from 'classnames';
import type { Entity } from '@dcl/ecs';

import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import {
  getExpanded,
  getHiddenNodes,
  getLockedNodes,
  getPlatform,
  getSelectedNode,
  getSelectedNodes,
  selectNode,
  selectNodes,
  setExpanded,
  setNodeHidden,
  setNodeLocked,
  setPlatform,
  toggleNodeSelection,
} from '../../../redux/ui-designer';
import { Tree } from '../../Tree';
import type { DropType } from '../../Tree/utils';
import { UI_DESIGNER_DND_TYPE, type UIDesignerDragItem } from '../shared/dnd';
import { useUINodeActions } from '../shared/useUINodeActions';
import { useUINodeTree } from '../shared/useUINodeTree';
import { WIDGET_ICONS } from '../shared/widget-catalog';
import { addPlatformBranch, spliceAddWidget, spliceMove, spliceRenameNode } from '../code/store';
import { PLATFORMS } from '../code/platform-convention';
import type { CodeUINode } from '../code/types';
import {
  classifyNode,
  matchesFilter,
  nodeLabelText,
  soleComponentRef,
  visibleRange,
  type UINode,
} from '../shared/tree-model';

import './NodeTree.css';

// Distinct from `UI_DESIGNER_DND_TYPE` (the palette + canvas DnD bus). The generic
// Tree<T> dispatches `{ items: T[], context }` payloads which are not compatible
// with `UIDesignerDragItem`, so the tree keeps its own DnD bus separate from the
// palette/canvas one.
const NODE_TREE_DND_TYPE = 'ui-designer-tree';

// The tree also ACCEPTS the palette bus so a new widget can be dropped straight
// into the hierarchy at a precise position. Module-level so the array reference
// stays stable across renders (avoids re-registering the drop target).
const EXTERNAL_DND_TYPES = [UI_DESIGNER_DND_TYPE];

const PLATFORM_ICONS = {
  desktop: <IoDesktopOutline />,
  mobile: <IoPhoneLandscapeOutline />,
};

const PLATFORM_LABELS = { desktop: 'Desktop', mobile: 'Mobile' };

// Entities on the path from `root` down to (but excluding) `target`. Used to
// auto-expand every ancestor so a selected node is always revealed in the tree.
function collectAncestors(root: UINode, target: Entity): Entity[] {
  const path: Entity[] = [];
  const walk = (node: UINode): boolean => {
    if (node.entity === target) return true;
    for (const child of node.children) {
      if (walk(child)) {
        path.push(node.entity);
        return true;
      }
    }
    return false;
  };
  walk(root);
  return path;
}

/**
 * Whether a row renames ITSELF, by writing its `@ui-name` marker. False for every
 * kind that has no name of its own to set: the root is 1:1 with the GUI, which
 * carries the name (renamed in the GUIs list) and reads here as its widget kind;
 * an opaque node isn't editable at all; a component row is named by the component
 * it references; and a platform variant or branch is labelled by its device.
 */
function isRenameableNode(n: UINode, root: UINode | null | undefined): boolean {
  if (root && n.entity === root.entity) return false;
  const cn = n as CodeUINode;
  return (
    !cn.opaque && !cn.componentRef && !cn.platformVariant && !cn.platform && !soleComponentRef(n)
  );
}

const NodeTreeImpl: React.FC<{ filter?: string }> = ({ filter = '' }) => {
  const term = filter.trim().toLowerCase();
  const dispatch = useAppDispatch();
  const tree = useUINodeTree();
  const expanded = useAppSelector(getExpanded);
  const selectedNode = useAppSelector(getSelectedNode);
  const selectedNodes = useAppSelector(getSelectedNodes);
  const hiddenNodes = useAppSelector(getHiddenNodes);
  const lockedNodes = useAppSelector(getLockedNodes);
  const platform = useAppSelector(getPlatform);

  // Memoise the Tree<UINode> component once per mount — Tree<T>() returns a
  // memoised component factory; constructing it in render would defeat memo.
  const NodeTreeComponent = useMemo(() => Tree<UINode>(), []);

  // Reveal the selected node in the tree: expand any collapsed ancestors and
  // scroll its row into view. Guarded by a ref so it only fires when the
  // selection itself changes — not when the user manually collapses a branch
  // (which would otherwise immediately re-expand under them).
  const lastRevealed = useRef<Entity | null>(null);
  useEffect(() => {
    if (!tree || selectedNode === null) return;
    if (lastRevealed.current === selectedNode) return;
    lastRevealed.current = selectedNode;
    for (const ancestor of collectAncestors(tree, selectedNode as Entity)) {
      if (expanded[ancestor as unknown as number] === false) {
        dispatch(setExpanded({ entity: ancestor, expanded: true }));
      }
    }
    requestAnimationFrame(() => {
      document
        .querySelector(`.ui-designer-nodetree [data-test-id="${String(selectedNode)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  }, [tree, selectedNode, expanded, dispatch]);

  const getId = useCallback((n: UINode) => String(n.entity), []);
  // Hide the sole component-ref child so the wrapper reads as one component node.
  const getChildren = useCallback(
    (n: UINode) => {
      if (soleComponentRef(n)) return [];
      return term ? n.children.filter(c => matchesFilter(c, term)) : n.children;
    },
    [term],
  );
  const getLabel = useCallback(
    (n: UINode) => {
      const ref = soleComponentRef(n);
      if (ref) return ref.componentRef?.name ?? ref.name;
      const cn = n as CodeUINode;
      // Elements read as their widget kind (Container vs Image for UiEntity);
      // opaque blocks and the platform variant keep their parse-side name.
      const label = nodeLabelText(n);
      // A platform branch reads dimmed while its device isn't the one being
      // edited — the row stays visible (and clickable, which switches device).
      const branch = cn.platform;
      if (!branch) return label;
      return (
        <span className={cx('ui-designer-tree-branch', { inactive: branch !== platform })}>
          {label}
        </span>
      );
    },
    [platform],
  );
  // A branch's icon IS its device badge; the variant itself gets the switch icon.
  const getIcon = useCallback((n: UINode) => {
    if (soleComponentRef(n)) return <IoCubeOutline />;
    const cn = n as CodeUINode;
    if (cn.platformVariant) return <IoSwapHorizontalOutline />;
    if (cn.platform) return PLATFORM_ICONS[cn.platform];
    return cn.opaque ? <IoWarningOutline /> : WIDGET_ICONS[classifyNode(n)];
  }, []);
  const isOpen = useCallback(
    // While filtering, force every surviving branch open so matches are visible
    // without hunting for them; otherwise honour the user's expand state.
    (n: UINode) => (term ? true : expanded[n.entity as unknown as number] !== false),
    [expanded, term],
  );
  const isSelected = useCallback((n: UINode) => selectedNodes.includes(n.entity), [selectedNodes]);
  const isHidden = useCallback(() => false, []);
  const canAddChild = useCallback(() => false, []);
  const canRename = useCallback((n: UINode) => isRenameableNode(n, tree), [tree]);

  const handleSetOpen = useCallback(
    (n: UINode, open: boolean) => dispatch(setExpanded({ entity: n.entity, expanded: open })),
    [dispatch],
  );

  // The shift-range anchor: the last plain-clicked row (the Tree reports it via
  // onLastSelectedChange, single clicks only — same convention as Hierarchy).
  const [lastSelected, setLastSelected] = useState<Entity | null>(null);
  const handleLastSelectedChange = useCallback((n: UINode) => setLastSelected(n.entity), []);

  // Picking a branch of the device that isn't active switches to that device —
  // which is what makes it the editable one, on the canvas and in the panel.
  // Ctrl/Cmd-click toggles membership; shift-click selects the visible range
  // from the anchor (#1400).
  const handleSelect = useCallback(
    (n: UINode, clickType?: 'single' | 'ctrl' | 'shift') => {
      const branch = (n as CodeUINode).platform;
      if (branch && branch !== platform) dispatch(setPlatform({ platform: branch }));
      if (clickType === 'ctrl') {
        dispatch(toggleNodeSelection({ node: n.entity }));
      } else if (clickType === 'shift' && lastSelected !== null && tree) {
        const range = visibleRange(tree, getChildren, isOpen, lastSelected, n.entity);
        if (range.length > 0) dispatch(selectNodes({ nodes: range }));
      } else {
        dispatch(selectNode({ node: n.entity }));
      }
    },
    [dispatch, platform, lastSelected, tree, getChildren, isOpen],
  );

  const handleDrop = useCallback((source: UINode, target: UINode, dropType: DropType) => {
    if (source.entity === target.entity) return;
    // Opaque nodes are read-only internally — never insert a child into one.
    // A component instance (`<Name />`) doesn't render arbitrary children
    // either; reorder relative to it instead.
    if ((target as CodeUINode).opaque && dropType === 'inside') return;
    if ((target as CodeUINode).componentRef && dropType === 'inside') return;
    // A platform branch has no room for siblings (it's an operand of the
    // conditional), and the variant node isn't an element to nest into. Dropping
    // before/after the variant itself is fine — that targets its parent.
    if ((target as CodeUINode).platform) return;
    if ((target as CodeUINode).platformVariant && dropType === 'inside') return;
    // Reparent/reorder by moving the element's source (the code equivalent of
    // setUIParent + reorderUISibling). 'inside' → last child of target;
    // 'before'/'after' → relative to the target sibling.
    void spliceMove(source.entity as unknown as number, {
      kind: dropType === 'inside' ? 'into' : dropType,
      targetId: target.entity as unknown as number,
    });
  }, []);

  // A palette widget dropped onto the tree ADDS a new node at that exact spot —
  // `inside` appends it as the target's last child, `before`/`after` insert it as
  // a sibling. (Reordering existing nodes stays in handleDrop above.)
  const handleExternalDrop = useCallback(
    (item: unknown, target: UINode, dropType: DropType) => {
      const drag = item as UIDesignerDragItem;
      if (drag.source !== 'palette') return; // only palette widgets add a node here
      const t = target as CodeUINode;
      // The root has no parent, so before/after has nowhere to go — append inside.
      const dt: DropType =
        target.entity === tree?.entity && dropType !== 'inside' ? 'inside' : dropType;
      // Can't nest INSIDE an opaque node, a component instance or a platform
      // variant (no editable children); before/after still works (it inserts into
      // their parent) — except beside a branch, which has no sibling slot.
      if (dt === 'inside' && (t.opaque || t.componentRef || t.platformVariant)) return;
      if (t.platform) return;
      void spliceAddWidget(target.entity as unknown as number, dt, drag.type, drag.preset);
    },
    [tree],
  );

  // Remove / duplicate share the canvas action bar's logic (selection fallback
  // included) via the useUINodeActions hook.
  const { remove, duplicate } = useUINodeActions();
  const handleRemove = useCallback((node: UINode) => remove(node.entity), [remove]);
  const handleDuplicate = useCallback((node: UINode) => duplicate(node.entity), [duplicate]);

  const handleRename = useCallback((node: UINode, label: string) => {
    const next = label.trim();
    if (next) void spliceRenameNode(node.entity as unknown as number, next);
  }, []);

  const noop = useCallback(() => undefined, []);

  // Editor-only lock/eye per row (replaces the generic Tree's engine-entity
  // ActionArea, which writes ECS Lock/Hide components — meaningless for code
  // nodes). Hide removes the node from the CANVAS render; lock blocks canvas
  // select/drag/resize and tree drags. Neither touches the code.
  const renderActionArea = useCallback(
    (n: UINode) => {
      const id = n.entity as unknown as number;
      // A variant renders no box, so lock/hide mean nothing on it. Its affordance
      // is filling in a device that has no branch yet (a hand-authored one-sided
      // conditional — the editor always seeds both).
      const cn = n as CodeUINode;
      if (cn.platformVariant) {
        const missing = PLATFORMS.filter(p => !cn.children.some(c => c.platform === p));
        if (missing.length === 0) return null;
        return (
          <div className="action-area">
            {missing.map(p => (
              <div
                key={p}
                className="action-button"
                role="button"
                aria-label={`Add ${PLATFORM_LABELS[p]} variant`}
                title={`Add a ${PLATFORM_LABELS[p]} variant`}
                onClick={e => {
                  e.stopPropagation();
                  void addPlatformBranch(id, p);
                }}
              >
                <IoAddOutline />
                {PLATFORM_ICONS[p]}
              </div>
            ))}
          </div>
        );
      }
      const isLocked = !!lockedNodes[id];
      const isNodeHidden = !!hiddenNodes[id];
      return (
        <div className={cx('action-area', { 'is-hidden': isNodeHidden })}>
          <div
            className="action-button"
            role="button"
            aria-label={isLocked ? 'Unlock node' : 'Lock node'}
            onClick={e => {
              e.stopPropagation();
              dispatch(setNodeLocked({ entity: n.entity, locked: !isLocked }));
            }}
          >
            {isLocked ? <LockIcon className="lock-icon" /> : <UnlockIcon className="unlock-icon" />}
          </div>
          <div
            className="action-button"
            role="button"
            aria-label={isNodeHidden ? 'Show node' : 'Hide node'}
            onClick={e => {
              e.stopPropagation();
              dispatch(setNodeHidden({ entity: n.entity, hidden: !isNodeHidden }));
            }}
          >
            {isNodeHidden ? (
              <InvisibleIcon className="invisible-icon" />
            ) : (
              <VisibleIcon className="visible-icon" />
            )}
          </div>
          <div
            className="action-button"
            role="button"
            aria-label={`Delete ${nodeLabelText(n)}`}
            onClick={e => {
              e.stopPropagation();
              handleRemove(n);
            }}
          >
            <RemoveIcon className="remove-icon" />
          </div>
        </div>
      );
    },
    [hiddenNodes, lockedNodes, dispatch, handleRemove],
  );

  // A branch can't leave its conditional, so it isn't draggable.
  const canDrag = useCallback(
    (n: UINode) => !lockedNodes[n.entity as unknown as number] && !(n as CodeUINode).platform,
    [lockedNodes],
  );

  if (!tree) return null;

  return (
    <div className="ui-designer-nodetree">
      <NodeTreeComponent
        value={tree}
        getId={getId}
        getChildren={getChildren}
        getLabel={getLabel}
        getIcon={getIcon}
        isOpen={isOpen}
        isSelected={isSelected}
        isHidden={isHidden}
        canAddChild={canAddChild}
        canRename={canRename}
        onSetOpen={handleSetOpen}
        onSelect={handleSelect}
        onLastSelectedChange={handleLastSelectedChange}
        onDrop={handleDrop}
        onRename={handleRename}
        onAddChild={noop}
        onRemove={handleRemove}
        onDuplicate={handleDuplicate}
        canDrag={canDrag}
        renderActionArea={renderActionArea}
        dndType={NODE_TREE_DND_TYPE}
        externalDndTypes={EXTERNAL_DND_TYPES}
        onExternalDrop={handleExternalDrop}
        allowBeforeDrop
      />
    </div>
  );
};

export const NodeTree = React.memo(NodeTreeImpl);

export default NodeTree;
