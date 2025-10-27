import type { InputHTMLAttributes } from 'react';
import type { Props as TextureProps } from '../Texture';

type InputProps = Pick<
  InputHTMLAttributes<HTMLElement>,
  'value' | 'onChange' | 'onFocus' | 'onBlur'
>;

export type UnlitMaterialProps = {
  diffuseColor: InputProps;
  castShadows: InputProps;
  alphaTest: InputProps;
  getTextureProps: TextureProps['getInputProps'];
};
