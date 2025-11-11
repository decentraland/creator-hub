import { useCallback } from 'react';
import { withSdk } from '../../../hoc/withSdk';
import { useHasComponent } from '../../../hooks/sdk/useHasComponent';
import { useComponentInput } from '../../../hooks/sdk/useComponentInput';
import { useAppSelector } from '../../../redux/hooks';
import { selectAssetCatalog } from '../../../redux/app';
import { Block } from '../../Block';
import { Dropdown } from '../../ui';
import { Container } from '../../Container';
import { fromMaterial, toMaterial, isValidMaterial, MATERIAL_TYPES } from './utils';
import UnlitMaterial from './UnlitMaterial/UnlitMaterial';
import { PbrMaterial } from './PbrMaterial';
import { type Props as TextureProps } from './Texture';
import { type Props, MaterialType } from './types';

export default withSdk<Props>(({ sdk, entity, initialOpen = true }) => {
  const files = useAppSelector(selectAssetCatalog);
  const { Material } = sdk.components;

  const hasMaterial = useHasComponent(entity, Material);
  const { getInputProps } = useComponentInput(
    entity,
    Material,
    fromMaterial(files?.basePath ?? ''),
    toMaterial(files?.basePath ?? ''),
    isValidMaterial,
  );

  const handleRemove = useCallback(async () => {
    sdk.operations.removeComponent(entity, Material);
    await sdk.operations.dispatch();
  }, []);

  if (!hasMaterial) return null;

  const materialType = getInputProps('type');
  const castShadows = getInputProps('castShadows', e => e.target.checked);
  const getTextureProps = getInputProps as TextureProps['getInputProps'];

  return (
    <Container
      label="Material"
      className="Material"
      initialOpen={initialOpen}
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
