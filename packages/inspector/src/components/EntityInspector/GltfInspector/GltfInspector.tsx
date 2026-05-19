import { useCallback } from 'react';

import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { useAssetOptions } from '../../../hooks/useAssetOptions';
import { Block } from '../../Block';
import { Container } from '../../Container';
import { FileUploadField, Dropdown, Label, InfoTooltip } from '../../ui';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';
import { useAppSelector } from '../../../redux/hooks';
import { selectAssetCatalog } from '../../../redux/app';
import { fromGltf, toGltf, isValidInput, COLLISION_LAYERS, isModel } from './utils';
import type { Props } from './types';

import './GltfInspector.css';

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const files = useAppSelector(selectAssetCatalog);
  const modelOptions = useAssetOptions(ACCEPTED_FILE_TYPES['model']);
  const { GltfContainer } = sdk.components;

  const hasGltf = useHasComponent(entity, GltfContainer);
  const handleInputValidation = useCallback(
    ({ src }: { src: string }) => !!files && isValidInput(files, src),
    [files],
  );
  const { getInputProps, isValid } = useComponentInput(entity, GltfContainer, fromGltf, toGltf, {
    validateInput: handleInputValidation,
    deps: [files],
  });

  const handleRemove = useCallback(async () => {
    const { VisibilityComponent, MeshCollider } = sdk.components;
    const hasMeshCollider = MeshCollider.has(entity);
    const hasVisibility = VisibilityComponent.has(entity);

    sdk.operations.removeComponent(entity, GltfContainer);

    if (hasVisibility && !hasMeshCollider) {
      sdk.operations.removeComponent(entity, VisibilityComponent);
    }

    await sdk.operations.dispatch();
  }, [sdk, entity]);

  const handleDrop = useCallback(async (src: string) => {
    const { operations } = sdk;
    operations.updateValue(GltfContainer, entity, { src });
    await operations.dispatch();
  }, []);

  if (!hasGltf) return null;

  return (
    <Container
      label="GLTF"
      className="GltfInspector"
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="The GLTF assigns a 3D model file for the item's visible shape. It also handles collisions, to make an item clickable or block the player from walking through it."
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      <Block>
        <FileUploadField
          {...getInputProps('src')}
          label="Path"
          accept={ACCEPTED_FILE_TYPES['model']}
          options={modelOptions}
          onDrop={handleDrop}
          error={files && !isValid}
          isValidFile={isModel}
        />
      </Block>
      <div className="column">
        <Label
          text="Collisions"
          header
        />
        <Block>
          <Dropdown
            label="Visible layer"
            options={COLLISION_LAYERS}
            {...getInputProps('visibleMeshesCollisionMask')}
          />
          <Dropdown
            label="Invisible layer"
            options={COLLISION_LAYERS}
            {...getInputProps('invisibleMeshesCollisionMask')}
          />
        </Block>
      </div>
    </Container>
  );
});
