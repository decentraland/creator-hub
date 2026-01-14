import { useCallback, useMemo } from 'react';

import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { TextField, Dropdown, InfoTooltip } from '../../ui';
import { fromMeshRenderer, toMeshRenderer, isValidInput, SHAPES } from './utils';

import { Props, MeshType } from './types';

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const { MeshRenderer } = sdk.components;

  const hasMeshRenderer = useHasComponent(entity, MeshRenderer);
  const { getInputProps } = useComponentInput(
    entity,
    MeshRenderer,
    fromMeshRenderer,
    toMeshRenderer,
    isValidInput,
  );

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, MeshRenderer);
    await sdk.operations.dispatch();
  }, []);

  const mesh = useMemo(() => getInputProps('mesh'), [getInputProps]);

  const renderComponent = useCallback(() => {
    switch (mesh.value) {
      case MeshType.MT_CYLINDER: {
        return (
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
        );
      }
      case MeshType.MT_SPHERE:
      default: {
        {
          /* {hasUvs(mesh.value) && <TextField label="Uvs" type="text" {...getInputProps('uvs')} />} */
        }
        return null;
      }
    }
  }, [mesh, getInputProps]);

  if (!hasMeshRenderer) return null;

  return (
    <Container
      label="MeshRenderer"
      className="MeshRenderer"
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Use MeshRenderer to assign a primitive 3D shape to the item. Instead of using a 3D file from GLTF, assign a simple cube, plane, sphere, or cylinder. These shapes can be used together with Materials"
          link="https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/shape-components#primitive-shapes"
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      <Block>
        <Dropdown
          label="Shape"
          options={SHAPES}
          {...mesh}
        />
      </Block>
      {renderComponent()}
    </Container>
  );
});
