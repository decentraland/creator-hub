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

const shouldIncludeAsset = (
  asset: IAsset,
  activeFilter: Filter,
  path: string,
  searchTerm: string,
): boolean => {
  // A search that matches nothing in this file's path leaves it (and, if it empties them, its
  // folders) out of the tree, so what remains is the hierarchy leading to the matches.
  if (searchTerm && !hasSearchMatch(path, searchTerm)) return false;
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

        if (shouldIncludeAsset(assetNode.asset, activeFilter, childPath, searchTerm)) {
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

/**
 * The children of a node in the folder tree. Searching and filtering are applied when the tree is
 * generated, which prunes it down to the folders that lead to a match, so the hierarchy is always
 * what gets listed here.
 */
export const getChildren = (val: string, tree: Map<string, TreeNode>): string[] =>
  tree.get(val)?.children ?? [];

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

  // Helper to get all matching files from a node or its children
  const getAllMatchingFiles = (startNode: TreeNode): TreeNode[] => {
    if (startNode.type === 'asset') {
      const assetFilter = mapAssetTypeToFilter((startNode as AssetNodeItem).asset);
      const matchesFilter =
        activeFilter === Filter.All ||
        activeFilter === Filter.Recents ||
        assetFilter === activeFilter;
      const matchesSearch =
        !searchTerm || startNode.name.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesFilter && matchesSearch ? [startNode] : [];
    }

    // If it's a folder, get matching files from children
    const childrenIds = startNode.children || [];
    return childrenIds.reduce((matches: TreeNode[], childId) => {
      const childNode = tree.get(childId);
      if (childNode) {
        matches.push(...getAllMatchingFiles(childNode));
      }
      return matches;
    }, []);
  };

  return getAllMatchingFiles(tree.get(ROOT)!);
};
