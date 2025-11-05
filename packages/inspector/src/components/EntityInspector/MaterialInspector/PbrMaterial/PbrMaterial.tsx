import { selectAssetCatalog } from '../../../../redux/app';
import { useAppSelector } from '../../../../redux/hooks';
import { Block } from '../../../Block';
import { Container } from '../../../Container';
import { CheckboxField, Dropdown, RangeField } from '../../../ui';
import { ColorField } from '../../../ui/ColorField';
import { Texture } from '../Texture';
import { TextureType } from '../types';
import { TRANSPARENCY_MODES } from '../utils';
import type { PbrMaterialProps } from './types';

function PbrMaterial({
  castShadows,
  metallic,
  roughness,
  albedoColor,
  reflectivityColor,
  specularIntensity,
  directIntensity,
  transparencyMode,
  alphaTest,
  emissiveIntensity,
  emissiveColor,
  getTextureProps,
  availableVideoPlayers,
}: PbrMaterialProps) {
  const files = useAppSelector(selectAssetCatalog);

  return (
    <>
      <Block>
        <CheckboxField
          label="Cast shadows"
          checked={!!castShadows.value}
          {...castShadows}
        />
      </Block>
      <Block>
        <RangeField
          label="Metallic"
          max={1}
          step={0.1}
          {...metallic}
        />
      </Block>
      <Block>
        <RangeField
          label="Roughness"
          max={1}
          step={0.1}
          {...roughness}
        />
      </Block>
      <Block>
        <ColorField
          label="Color"
          {...albedoColor}
        />
      </Block>
      <Block>
        <ColorField
          label="Reflectivity color"
          {...reflectivityColor}
        />
      </Block>
      <Texture
        label="Texture"
        texture={TextureType.TT_TEXTURE}
        files={files}
        getInputProps={getTextureProps}
        availableVideoPlayers={availableVideoPlayers}
      />
      <Container
        label="Intensity"
        border
        initialOpen={false}
      >
        <RangeField
          label="Specular"
          max={1}
          step={0.1}
          {...specularIntensity}
        />
        <RangeField
          label="Direct"
          max={1}
          step={0.1}
          {...directIntensity}
        />
      </Container>
      <Container
        label="Transparency"
        border
        initialOpen={false}
      >
        <Block>
          <Dropdown
            label="Transparency Mode"
            options={TRANSPARENCY_MODES}
            {...transparencyMode}
          />
        </Block>
        <Block>
          <RangeField
            label="Alpha test"
            max={1}
            step={0.1}
            {...alphaTest}
          />
        </Block>
      </Container>
      <Container
        label="Emissive"
        border
        initialOpen={false}
      >
        <Block>
          <RangeField
            label="Emissive Intensity"
            max={1}
            step={0.1}
            {...emissiveIntensity}
          />
        </Block>
        <Block>
          <ColorField
            label="Emissive color"
            {...emissiveColor}
          />
        </Block>
        <Texture
          label="Emissive texture"
          texture={TextureType.TT_EMISSIVE_TEXTURE}
          files={files}
          getInputProps={getTextureProps}
        />
      </Container>
      <Texture
        label="Bump texture"
        texture={TextureType.TT_BUMP_TEXTURE}
        files={files}
        getInputProps={getTextureProps}
      />
    </>
  );
}

export default PbrMaterial;
