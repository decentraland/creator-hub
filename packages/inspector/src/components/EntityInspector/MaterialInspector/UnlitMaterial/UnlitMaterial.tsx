import { selectAssetCatalog } from '../../../../redux/app';
import { useAppSelector } from '../../../../redux/hooks';
import { Block } from '../../../Block';
import { CheckboxField, RangeField } from '../../../ui';
import { ColorField } from '../../../ui/ColorField';
import { Texture } from '../Texture';
import { TextureType } from '../types';
import type { UnlitMaterialProps } from './types';

function UnlitMaterial({
  diffuseColor,
  castShadows,
  alphaTest,
  getTextureProps,
}: UnlitMaterialProps) {
  const files = useAppSelector(selectAssetCatalog);
  return (
    <>
      <Block label="Diffuse color">
        <ColorField {...diffuseColor} />
      </Block>
      <Block>
        <CheckboxField
          label="Cast shadows"
          checked={!!castShadows.value}
          {...castShadows}
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
      <Texture
        label="Texture"
        texture={TextureType.TT_TEXTURE}
        files={files}
        getInputProps={getTextureProps}
      />
      <Texture
        label="Alpha texture"
        texture={TextureType.TT_ALPHA_TEXTURE}
        files={files}
        getInputProps={getTextureProps}
      />
    </>
  );
}

export default UnlitMaterial;
