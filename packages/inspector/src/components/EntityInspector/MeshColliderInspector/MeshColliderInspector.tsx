import { useCallback } from 'react';

import { withSdk } from '../../../hoc/withSdk';
import { useAllEntitiesHaveComponent } from '../../../hooks/sdk/useHasComponent';
import { useMultiComponentInput } from '../../../hooks/sdk/useComponentInput';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { TextField, Dropdown } from '../../ui';
import { SHAPES } from '../MeshRendererInspector/utils';
import { MeshType } from '../MeshRendererInspector/types';
import { COLLISION_LAYERS } from '../GltfInspector/utils';
import { fromMeshCollider, toMeshCollider, isValidInput } from './utils';
import { type Props } from './types';

export default withSdk<Props>(({ sdk, entities, initialOpen = true }) => {
  const { MeshCollider } = sdk.components;

  const allEntitiesHaveMeshCollider = useAllEntitiesHaveComponent(entities, MeshCollider);
  const { getInputProps } = useMultiComponentInput(
    entities,
    MeshCollider,
    fromMeshCollider,
    toMeshCollider,
    isValidInput,
  );

  const handleRemove = useCallback(async () => {
    const { VisibilityComponent, GltfContainer } = sdk.components;

    for (const entity of entities) {
      const hasGltfContainer = GltfContainer.has(entity);
      const hasVisibility = VisibilityComponent.has(entity);

      sdk.operations.removeComponent(entity, MeshCollider);

      if (hasVisibility && !hasGltfContainer) {
        sdk.operations.removeComponent(entity, VisibilityComponent);
      }
    }

    await sdk.operations.dispatch();
  }, [sdk, entities, MeshCollider]);

  if (!allEntitiesHaveMeshCollider) return null;

  const mesh = getInputProps('mesh');

  return (
    <Container
      label="MeshCollider"
      className="MeshCollider"
      initialOpen={initialOpen}
      onRemoveContainer={handleRemove}
    >
      <Block>
        <Dropdown
          label="Shape"
          options={SHAPES}
          {...mesh}
        />
        <Dropdown
          label="Collision layer"
          options={COLLISION_LAYERS}
          {...getInputProps('collisionMask')}
        />
      </Block>
      {mesh.value === MeshType.MT_CYLINDER && (
        <Block label="Radius">
          <TextField
            autoSelect
            leftLabel="Top"
            type="number"
            {...getInputProps('radiusTop')}
          />
          <TextField
            autoSelect
            leftLabel="Bottom"
            type="number"
            {...getInputProps('radiusBottom')}
          />
        </Block>
      )}
    </Container>
  );
});
