import type { ValidationResult as Gltf } from '@dcl/gltf-validator-ts';

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

export type AssetType = 'Models' | 'Images' | 'Audio' | 'Video' | 'Other';

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
