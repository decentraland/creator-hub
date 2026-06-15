import React, { useCallback, useMemo } from 'react';
import { IoLayersOutline } from 'react-icons/io5';
import type { Entity, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import { Name as NameEngine } from '@dcl/ecs';
import type { UI } from '@dcl/asset-packs';
import { ComponentName } from '@dcl/asset-packs';

import { useSdk } from '../../hooks/sdk/useSdk';
import { useEntitiesWith } from '../../hooks/sdk/useEntitiesWith';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { getSelectedRoot, selectRoot } from '../../redux/ui-designer';
import { Button } from '../Button';
import { Tree } from '../Tree';

import './RootsList.css';

type UIRootNode = {
  entity: Entity;
  name: string;
};

const RootTree = Tree<UIRootNode>();

export const RootsList: React.FC = () => {
  const sdk = useSdk();
  const dispatch = useAppDispatch();
  const selected = useAppSelector(getSelectedRoot);

  // Reactively track entities carrying the asset-packs::UI marker. The hook
  // re-derives the list whenever the UI component value changes (create, update, delete).
  // The UI component is registered via asset-packs (not on sdk.components), so we
  // resolve it via the SDK closure — useEntitiesWith only invokes this once sdk is ready.
  const uiEntities = useEntitiesWith(
    () =>
      sdk!.engine.getComponent(
        ComponentName.UI,
      ) as unknown as LastWriteWinElementSetComponentDefinition<UI>,
  );

  const roots = useMemo<UIRootNode[]>(() => {
    if (!sdk) return [];
    const UIComp = sdk.engine.getComponent(
      ComponentName.UI,
    ) as LastWriteWinElementSetComponentDefinition<UI>;
    return uiEntities.map(entity => ({
      entity,
      name: UIComp.getOrNull(entity)?.name ?? '',
    }));
  }, [sdk, uiEntities]);

  const handleCreate = useCallback(async () => {
    if (!sdk) return;
    const entity = sdk.operations.createUIRoot('Untitled UI');
    // Await the dispatch so the engine has fully flushed the new entity's
    // components before we trigger the tree re-derive. Without this, the
    // walker runs against a stale snapshot and returns null until something
    // else triggers a change event (rename, etc.).
    await sdk.operations.dispatch();
    dispatch(selectRoot({ root: entity }));
  }, [sdk, dispatch]);

  const handleSelect = useCallback(
    (node: UIRootNode) => dispatch(selectRoot({ root: node.entity })),
    [dispatch],
  );

  const handleRename = useCallback(
    (node: UIRootNode, label: string) => {
      if (!sdk) return;
      const UIComp = sdk.engine.getComponent(
        ComponentName.UI,
      ) as LastWriteWinElementSetComponentDefinition<UI>;
      sdk.operations.updateValue(UIComp, node.entity, { name: label });
      // Mirror the marker name into the inspector Name component (used as entity display name).
      const Name = sdk.engine.getComponent(NameEngine.componentName) as typeof NameEngine;
      if (Name.getOrNull(node.entity)) {
        sdk.operations.updateValue(Name, node.entity, { value: label });
      }
      void sdk.operations.dispatch();
    },
    [sdk],
  );

  const handleRemove = useCallback(
    (node: UIRootNode) => {
      if (!sdk) return;
      sdk.operations.removeUINode(node.entity);
      void sdk.operations.dispatch();
      if (selected === node.entity) dispatch(selectRoot({ root: null }));
    },
    [sdk, selected, dispatch],
  );

  const handleDuplicate = useCallback(
    async (node: UIRootNode) => {
      if (!sdk) return;
      const clone = sdk.operations.duplicateUINode(node.entity);
      const UIComp = sdk.engine.getComponent(
        ComponentName.UI,
      ) as LastWriteWinElementSetComponentDefinition<UI>;
      const baseName = node.name || 'Untitled UI';
      sdk.operations.updateValue(UIComp, clone, { name: `${baseName} copy` });
      await sdk.operations.dispatch();
      dispatch(selectRoot({ root: clone }));
    },
    [sdk, dispatch],
  );

  const getId = useCallback((n: UIRootNode) => String(n.entity), []);
  const getChildren = useCallback(() => [] as UIRootNode[], []);
  const getLabel = useCallback((n: UIRootNode) => n.name || 'Untitled UI', []);
  const getIcon = useCallback(() => <IoLayersOutline />, []);
  const isOpen = useCallback(() => false, []);
  const isSelected = useCallback((n: UIRootNode) => n.entity === selected, [selected]);
  const isHidden = useCallback(() => false, []);
  const canAddChild = useCallback(() => false, []);
  const noop = useCallback(() => undefined, []);

  return (
    <div className="ui-designer-roots-list">
      <div className="ui-designer-roots-header">
        <Button onClick={handleCreate}>+ New UI</Button>
      </div>
      <div className="ui-designer-roots-tree">
        {roots.map(root => (
          <RootTree
            key={getId(root)}
            value={root}
            getId={getId}
            getChildren={getChildren}
            getLabel={getLabel}
            getIcon={getIcon}
            isOpen={isOpen}
            isSelected={isSelected}
            isHidden={isHidden}
            canAddChild={canAddChild}
            onSetOpen={noop}
            onSelect={handleSelect}
            onDrop={noop}
            onRename={handleRename}
            onAddChild={noop}
            onRemove={handleRemove}
            onDuplicate={handleDuplicate}
            dndType="ui-roots"
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(RootsList);
