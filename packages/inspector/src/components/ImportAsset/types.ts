import type { ValidationResult as Gltf } from '@dcl/gltf-validator-ts';
import type { TreeNode } from '../ProjectAssetExplorer/ProjectView';
import type { Props as DropdownProps } from '../ui/Dropdown/types';

export type {
  ValidationResult as Gltf,
  ValidationInfo as GltfInfo,
  Resource as GltfResource,
  Issues as GltfIssues,
  ValidationMessage as GltfMessage,
} from '@dcl/gltf-validator-ts';

export type BaseAsset = {
  blob: File;
  name: string;
  extension: string;
  error?: ValidationError;
  thumbnail?: string;
};

export type ModelAsset = BaseAsset & {
  gltf: Gltf;
  buffers: BaseAsset[];
  images: BaseAsset[];
};

export type Asset = ModelAsset | BaseAsset;

export type ValidationError =
  | {
      type: 'size' | 'type' | 'name' | 'model';
      message: string;
    }
  | undefined;

export type AssetType = 'Models' | 'Images' | 'Audio' | 'Video' | 'Scripts' | 'Other';

export const isModelAsset = (asset: Asset): asset is ModelAsset => {
  const _asset = asset as any;
  return _asset.buffers && _asset.images;
};

// this interface is specific to our implementation and not available in gltf-validator-ts
export interface GltfImage {
  width: number;
  height: number;
  format: string;
  primaries: string;
  transfer: string;
  bits: number;
}

// ImportAsset component props

export type ImportAssetMode = 'wrapper' | 'field';

interface BaseProps {
  /** Whether to allow multiple file imports (default: true for wrapper, false for field) */
  multiple?: boolean;
  /** Accepted file extensions */
  accept?: string[];
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Called after successful import with the imported asset paths */
  onImportComplete?: (paths: string[]) => void;
}

export interface WrapperModeProps extends BaseProps {
  mode?: 'wrapper';
  /** Children to wrap (the drop zone area) */
  children: React.ReactNode;
  /** Called when import is complete (legacy callback) */
  onSave?: () => void;
}

export interface FieldModeProps extends BaseProps {
  mode: 'field';
  /** Current value (controlled) */
  value?: string | number;
  /** Field label */
  label?: string;
  /** Error message to display */
  error?: string;
  /** CSS class name */
  className?: string;
  /** Dropdown options for selecting existing assets */
  options?: DropdownProps['options'];
  /** Called when value changes via dropdown or URL */
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Called when value changes via drop or selection */
  onDrop?: (path: string) => void;
  /** Whether to show URL input option */
  acceptURLs?: boolean;
  /** Whether to show file explorer button (default: true) */
  showFileExplorer?: boolean;
  /** Whether to allow drag & drop from asset catalog (default: true) */
  allowCatalogDrop?: boolean;
  /** Custom validation function for dropped nodes */
  isValidFile?: (node: TreeNode) => boolean;
  /** Open file explorer on mount */
  openFileExplorerOnMount?: boolean;
  /** Children are not allowed in field mode */
  children?: never;
}

export type ImportAssetProps = WrapperModeProps | FieldModeProps;

export function isFieldMode(props: ImportAssetProps): props is FieldModeProps {
  return props.mode === 'field';
}

export function isWrapperMode(props: ImportAssetProps): props is WrapperModeProps {
  return props.mode !== 'field';
}
