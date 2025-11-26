import * as BABYLON from '@babylonjs/core';
import type { PBNftShape } from '@dcl/ecs';
import { ComponentType } from '@dcl/ecs';

import nftGlbDataUrl from '../../assets/nft.glb';
import type { ComponentOperation } from '../component-operations';
import { loadBundledGltf, removeGltf } from './gltf-container';

export const putNftShapeComponent: ComponentOperation = (entity, component) => {
  if (component.componentType === ComponentType.LastWriteWinElementSet) {
    const newValue = component.getOrNull(entity.entityId) as PBNftShape | null;
    const context = entity.context.deref();

    if (!context) {
      return;
    }

    if (!newValue) {
      removeGltf(entity);
      return;
    }

    loadBundledGltf(entity, nftGlbDataUrl)
      .then(assetContainer => {
        // Find the main mesh and add it as the gltf container
        assetContainer.meshes
          .filter(mesh => mesh.name === '__root__')
          .forEach(mesh => {
            mesh.parent = entity;
            entity.setGltfContainer(mesh);
          });

        entity.setGltfAssetContainer(assetContainer);
        entity.generateBoundingBox();

        // Apply NFT-specific scaling and positioning
        if (entity.gltfAssetContainer) {
          entity.gltfAssetContainer.meshes[0].scaling = new BABYLON.Vector3(1, 1, 0.1);
          entity.gltfAssetContainer.meshes[0].position = new BABYLON.Vector3(0, -0.25, 0);
        }
      })
      .catch(error => {
        console.error('Error loading NFT placeholder:', error);
      });
  }
};
