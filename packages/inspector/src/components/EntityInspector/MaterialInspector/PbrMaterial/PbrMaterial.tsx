import { selectAssetCatalog } from '../../../../redux/app';
import { useAppSelector } from '../../../../redux/hooks';
import { Block } from '../../../Block';
import { Container } from '../../../Container';
import { CheckboxField, Dropdown, InfoTooltip, RangeField } from '../../../ui';
import { ColorField } from '../../../ui/ColorField';
import { Texture } from '../Texture';
import { TextureType } from '../types';
import { TRANSPARENCY_MODES, usesAlphaTest } from '../utils';
import type { PbrMaterialProps } from './types';

function PbrMaterial({
  castShadows,
  metallic,
  roughness,
  albedoColor,
  albedoColorAlpha,
  reflectivityColor,
  specularIntensity,
  directIntensity,
  transparencyMode,
  alphaTest,
  emissiveIntensity,
  emissiveColor,
  getTextureProps,
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
          clearable
          {...albedoColor}
        />
      </Block>
      {albedoColorAlpha && (
        <Block>
          <RangeField
            label={
              <>
                Color Alpha{' '}
                <InfoTooltip
                  text="Opacity of the Color: 1 is fully opaque, 0 is fully transparent. Has no effect when Transparency Mode is Opaque."
                  type="help"
                />
              </>
            }
            max={1}
            step={0.01}
            {...albedoColorAlpha}
          />
        </Block>
      )}
      <Block>
        <ColorField
          label="Reflectivity color"
          clearable
          {...reflectivityColor}
        />
      </Block>
      <Texture
        label="Texture"
        texture={TextureType.TT_TEXTURE}
        files={files}
        getInputProps={getTextureProps}
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
        {usesAlphaTest(transparencyMode.value as string | number | undefined) && (
          <Block>
            <RangeField
              label={
                <>
                  Alpha test{' '}
                  <InfoTooltip
                    text="Pixels with alpha below this threshold are cut out; the rest are fully opaque."
                    type="help"
                  />
                </>
              }
              max={1}
              step={0.1}
              {...alphaTest}
            />
          </Block>
        )}
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
            clearable
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
