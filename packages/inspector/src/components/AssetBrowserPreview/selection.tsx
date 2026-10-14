import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Asset, CustomAsset } from '../../lib/logic/catalog';

export type AssetSelection =
  | { source: 'local'; id: string; name: string; path: string }
  | { source: 'catalog'; id: string; name: string; asset: Asset }
  | { source: 'custom'; id: string; name: string; asset: CustomAsset };

type AssetSelectionContextValue = {
  selection: AssetSelection | undefined;
  select: (selection: AssetSelection | undefined) => void;
};

const noop = () => {};

const AssetSelectionContext = createContext<AssetSelectionContextValue>({
  selection: undefined,
  select: noop,
});

export function AssetSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<AssetSelection | undefined>(undefined);
  const select = useCallback((next: AssetSelection | undefined) => setSelection(next), []);
  const value = useMemo(() => ({ selection, select }), [selection, select]);
  return <AssetSelectionContext.Provider value={value}>{children}</AssetSelectionContext.Provider>;
}

export function useAssetSelection() {
  return useContext(AssetSelectionContext);
}

/** True when `source`/`id` is the asset currently shown in the preview pane. */
export function useIsAssetSelected(source: AssetSelection['source'], id: string) {
  const { selection } = useAssetSelection();
  return selection?.source === source && selection.id === id;
}
