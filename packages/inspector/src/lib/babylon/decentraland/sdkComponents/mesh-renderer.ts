import type { Mesh } from '@babylonjs/core';
import { MeshBuilder, VertexBuffer } from '@babylonjs/core';
import type { PBMeshRenderer } from '@dcl/ecs';
import { ComponentType } from '@dcl/ecs';

import type { ComponentOperation } from '../component-operations';
import type { EcsEntity } from '../EcsEntity';
import { toggleMeshSelection } from '../editorComponents/selection';
import { setMeshRendererMaterial } from './material';
import { applyVideoPlayerMaterial } from './video-player';

export const putMeshRendererComponent: ComponentOperation = (entity, component) => {
  if (component.componentType === ComponentType.LastWriteWinElementSet) {
    const newValue = component.getOrNull(entity.entityId) as PBMeshRenderer | null;
    entity.ecsComponentValues.meshRenderer = newValue || undefined;

    // for simplicity of the example, we will remove the Mesh on every update.
    // this is not optimal for production code, re-using when possible is RECOMMENDED
    removeMeshRenderer(entity);

    let mesh: Mesh | undefined = undefined;

    // Get the scene - use entity.scene directly as it's more reliable
    const scene = entity.scene || entity.getScene();

    if (!scene) {
      console.error('Cannot create mesh renderer: scene is undefined');
      return;
    }

    // then proceed to create the desired MeshRenderer
    if (newValue?.mesh?.$case === 'box') {
      mesh = MeshBuilder.CreateBox(entity.entityId.toString(), { updatable: false }, scene);
      setMeshUvs(mesh, newValue.mesh.box.uvs);
    } else if (newValue?.mesh?.$case === 'sphere') {
      mesh = MeshBuilder.CreateSphere(
        entity.entityId.toString(),
        { diameter: 1, updatable: false, segments: 8 },
        scene,
      );
    } else if (newValue?.mesh?.$case === 'cylinder') {
      mesh = MeshBuilder.CreateCylinder(
        'cone',
        {
          diameterTop:
            newValue.mesh.cylinder.radiusTop !== undefined
              ? newValue.mesh.cylinder.radiusTop * 2
              : 1,
          diameterBottom:
            newValue.mesh.cylinder.radiusBottom !== undefined
              ? newValue.mesh.cylinder.radiusBottom * 2
              : 1,
          enclose: true,
          subdivisions: 16,
          tessellation: 16,
          arc: Math.PI * 2,
          updatable: false,
          height: 1,
        },
        scene,
      );
    } else if (newValue?.mesh?.$case === 'plane') {
      mesh = MeshBuilder.CreatePlane(
        'plane-shape',
        {
          width: 1,
          height: 1,
          sideOrientation: 2,
          updatable: false,
        },
        scene,
      );

      setMeshUvs(mesh, newValue.mesh.plane.uvs);
    }

    if (mesh) {
      mesh.parent = entity;
      entity.setMeshRenderer(mesh);
      entity.generateBoundingBox();
    }

    // make the renderer interactable only if the entity is Pickable
    if (entity.meshRenderer) {
      entity.meshRenderer.isPickable = true;
      toggleMeshSelection(
        entity.meshRenderer,
        entity.context.deref()?.editorComponents.Selection.has(entity.entityId) || false,
      );
    }

    setMeshRendererMaterial(entity);

    // Apply video player material if entity has VideoPlayer component
    // This needs to happen after setMeshRendererMaterial to override the ECS material
    void applyVideoPlayerMaterial(entity);
  }
};

function removeMeshRenderer(entity: EcsEntity) {
  if (entity.meshRenderer) {
    entity.meshRenderer.setEnabled(false);
    entity.meshRenderer.parent = null;
    entity.meshRenderer.dispose(false, false);
    delete entity.meshRenderer;
  }
}

function setMeshUvs(mesh: Mesh, uvs: number[] = []) {
  if (!uvs.length) {
    mesh.updateVerticesData(VertexBuffer.UVKind, [0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0]);
  } else {
    mesh.updateVerticesData(VertexBuffer.UVKind, uvs);
  }
}
