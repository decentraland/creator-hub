import type { InputHTMLAttributes } from 'react';
import type { Props as TextureProps } from '../Texture';

type InputProps = Pick<
  InputHTMLAttributes<HTMLElement>,
  'value' | 'onChange' | 'onFocus' | 'onBlur'
>;

export type PbrMaterialProps = {
  castShadows: InputProps;
  metallic: InputProps;
  roughness: InputProps;
  albedoColor: InputProps;
  reflectivityColor: InputProps;
  specularIntensity: InputProps;
  directIntensity: InputProps;
  transparencyMode: InputProps;
  alphaTest: InputProps;
  emissiveIntensity: InputProps;
  emissiveColor: InputProps;
  getTextureProps: TextureProps['getInputProps'];
};
