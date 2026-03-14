import { useCallback } from 'react';
import { withSdk } from '../../../hoc/withSdk';
import { useAllEntitiesHaveComponent } from '../../../hooks/sdk/useHasComponent';
import { useMultiComponentInput } from '../../../hooks/sdk/useComponentInput';
import { Block } from '../../Block';
import { Dropdown, InfoTooltip } from '../../ui';
import { Container } from '../../Container';
import { fromMaterial, toMaterial, isValidMaterial, MATERIAL_TYPES } from './utils';
import UnlitMaterial from './UnlitMaterial/UnlitMaterial';
import { PbrMaterial } from './PbrMaterial';
import { type Props as TextureProps } from './Texture';
import { type Props, MaterialType } from './types';

export default withSdk<Props>(({ sdk, entities, initialOpen = true }) => {
  const { Material } = sdk.components;

  const allEntitiesHaveMaterial = useAllEntitiesHaveComponent(entities, Material);

  const { getInputProps } = useMultiComponentInput(entities, Material, fromMaterial, toMaterial, {
    validateInput: isValidMaterial,
  });

  const handleRemove = useCallback(async () => {
    for (const entity of entities) {
      sdk.operations.removeComponent(entity, Material);
    }
    await sdk.operations.dispatch();
  }, [sdk, entities, Material]);

  if (!allEntitiesHaveMaterial) return null;

  const materialType = getInputProps('type');
  const castShadows = getInputProps('castShadows', e => e.target.checked);
  const getTextureProps = getInputProps as TextureProps['getInputProps'];

  return (
    <Container
      label="Material"
      className="Material"
      initialOpen={initialOpen}
      rightContent={
        <InfoTooltip
          text="Material determines the visual appearance of an object. It defines properties such as color, texture, and transparency"
          link="https://docs.decentraland.org/creator/scenes-sdk7/3d-content-essentials/materials"
          type="help"
        />
      }
      onRemoveContainer={handleRemove}
    >
      <Block>
        <Dropdown
          label="Material"
          options={MATERIAL_TYPES}
          {...materialType}
        />
      </Block>

      {materialType.value === MaterialType.MT_UNLIT && (
        <UnlitMaterial
          diffuseColor={getInputProps('diffuseColor')}
          castShadows={castShadows}
          alphaTest={getInputProps('alphaTest')}
          getTextureProps={getTextureProps}
        />
      )}

      {materialType.value === MaterialType.MT_PBR && (
        <PbrMaterial
          castShadows={castShadows}
          metallic={getInputProps('metallic')}
          roughness={getInputProps('roughness')}
          albedoColor={getInputProps('albedoColor')}
          reflectivityColor={getInputProps('reflectivityColor')}
          specularIntensity={getInputProps('specularIntensity')}
          directIntensity={getInputProps('directIntensity')}
          transparencyMode={getInputProps('transparencyMode')}
          alphaTest={getInputProps('alphaTest')}
          emissiveIntensity={getInputProps('emissiveIntensity')}
          emissiveColor={getInputProps('emissiveColor')}
          getTextureProps={getTextureProps}
        />
      )}
    </Container>
  );
});
