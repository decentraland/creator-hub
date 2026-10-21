import { Filter } from './Filters/types';
import type { AssetNode, AssetNodeFolder, AssetNodeItem, IAsset } from './types';
import { mapAssetTypeToFilter } from './utils';

export const ROOT = 'File System';

const joinPath = (parent: string, child: string): string => {
  if (!parent) return child;
  return `${parent}/${child}`;
};

const hasSearchMatch = (name: string, searchTerm: string): boolean => {
  return !!(searchTerm && name.toLowerCase().includes(searchTerm.toLowerCase()));
};

const shouldIncludeAsset = (asset: IAsset, activeFilter: Filter): boolean => {
  if (activeFilter === Filter.All || activeFilter === Filter.Recents) {
    return true;
  }
  const assetFilter = mapAssetTypeToFilter(asset);
  return assetFilter === activeFilter;
};

export type TreeNode = Omit<AssetNode, 'children'> & { children?: string[]; matches?: string[] };

interface TreeGenerationResult {
  tree: Map<string, TreeNode>;
  filters: Set<Filter>;
}

// Main tree generation function
export const generateAssetTree = (
  folders: AssetNodeFolder[],
  openNodes: Set<string>,
  searchTerm: string = '',
  activeFilter: Filter = Filter.All,
): TreeGenerationResult => {
  const tree = new Map<string, TreeNode>();
  const foundFilters = new Set<Filter>();

  // Initialize root node
  tree.set(ROOT, {
    children: folders.map(folder => folder.name),
    name: ROOT,
    type: 'folder',
    parent: null,
  });
  openNodes.add(ROOT);

  // Helper function to process a folder and get valid children
  const processFolder = (
    folderNode: AssetNodeFolder,
    currentPath: string,
  ): { children: string[]; hasValidChildren: boolean } => {
    const validChildren: string[] = [];
    let hasValidChildren = false;

    for (const child of folderNode.children) {
      const childPath = joinPath(currentPath, child.name);

      if (child.type === 'folder') {
        const { children: subChildren, hasValidChildren: hasValid } = processFolder(
          child as AssetNodeFolder,
          childPath,
        );
        if (hasValid) {
          tree.set(childPath, {
            ...child,
            children: subChildren,
            parent: folderNode,
            matches: [],
          });
          validChildren.push(childPath);
          hasValidChildren = true;
        }
      } else {
        const assetNode = child as AssetNodeItem;
        const filter = mapAssetTypeToFilter(assetNode.asset);
        if (filter) foundFilters.add(filter);

        if (shouldIncludeAsset(assetNode.asset, activeFilter)) {
          validChildren.push(childPath);
          hasValidChildren = true;
          tree.set(childPath, {
            ...assetNode,
            parent: folderNode,
            matches: hasSearchMatch(childPath, searchTerm) ? [childPath] : [],
          });
        }
      }
    }

    return { children: validChildren, hasValidChildren };
  };

  // Build the filtered tree
  const validRootFolders: string[] = [];

  for (const folder of folders) {
    const folderPath = folder.name;
    const { children, hasValidChildren } = processFolder(folder, folderPath);

    if (hasValidChildren) {
      validRootFolders.push(folderPath);
      tree.set(folderPath, {
        ...folder,
        children,
        parent: null,
        matches: [],
      });
    }
  }

  // Update root node with only valid folders
  tree.set(ROOT, {
    name: ROOT,
    type: 'folder',
    parent: null,
    children: validRootFolders,
  });

  return { tree, filters: foundFilters };
};

/** The children of a node. The tree is the whole project; search and type filters never prune it. */
export const getChildren = (val: string, tree: Map<string, TreeNode>): string[] =>
  tree.get(val)?.children ?? [];

// Whether a file belongs in the results of the current search and type filter.
export const isMatch = (node: TreeNode, searchTerm: string, activeFilter: Filter): boolean => {
  const matchesFilter =
    activeFilter === Filter.All ||
    activeFilter === Filter.Recents ||
    mapAssetTypeToFilter((node as AssetNodeItem).asset) === activeFilter;
  const matchesSearch = !searchTerm || node.name.toLowerCase().includes(searchTerm.toLowerCase());
  return matchesFilter && matchesSearch;
};

/**
 * What the file area lists for `nodeId`. Without a search or type filter that is the folder's own
 * contents. With one, it is every matching file at or below the folder (the whole project when the
 * root is selected), so a filter can be narrowed by picking a folder in the tree.
 */
export const getTiles = (
  nodeId: string,
  tree: Map<string, TreeNode>,
  searchTerm: string,
  activeFilter: Filter,
): TreeNode[] => {
  // For 'all' or 'recents' with no search, just return the children or the node itself
  if ((activeFilter === Filter.All || activeFilter === Filter.Recents) && !searchTerm) {
    const node = tree.get(nodeId);
    if (!node) return [];
    if (node.type === 'asset') return [node];

    const children = node.children ?? [];
    return children.map($ => tree.get($)!);
  }

  const getAllMatchingFiles = (startNode: TreeNode): TreeNode[] => {
    if (startNode.type === 'asset') {
      return isMatch(startNode, searchTerm, activeFilter) ? [startNode] : [];
    }
    return (startNode.children || []).flatMap(childId => {
      const childNode = tree.get(childId);
      return childNode ? getAllMatchingFiles(childNode) : [];
    });
  };

  return getAllMatchingFiles(tree.get(nodeId) ?? tree.get(ROOT)!);
};

/**
 * How many files under each folder match the current search and type filter. Folders with no
 * matches are left out, so the tree can show where the results are without hiding anything.
 */
export const countMatches = (
  tree: Map<string, TreeNode>,
  searchTerm: string,
  activeFilter: Filter,
): Map<string, number> => {
  const counts = new Map<string, number>();
  const visit = (id: string): number => {
    const node = tree.get(id);
    if (!node) return 0;
    if (node.type === 'asset') return isMatch(node, searchTerm, activeFilter) ? 1 : 0;
    const total = (node.children ?? []).reduce((sum, childId) => sum + visit(childId), 0);
    if (total > 0 && id !== ROOT) counts.set(id, total);
    return total;
  };
  visit(ROOT);
  return counts;
};
