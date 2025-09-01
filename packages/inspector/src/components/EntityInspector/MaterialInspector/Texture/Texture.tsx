import { useCallback } from 'react';

import { removeBasePath } from '../../../../lib/logic/remove-base-path';
import { Block } from '../../../Block';
import { Container } from '../../../Container';
import { Dropdown, FileUploadField, TextField } from '../../../ui';
import { ACCEPTED_FILE_TYPES } from '../../../ui/FileUploadField/types';
import { isModel, isValidTexture } from './utils';

import { type Props, Texture, TEXTURE_TYPES, WRAP_MODES, FILTER_MODES } from './types';

function TextureInspector({ label, texture, files, getInputProps }: Props) {
  const getTextureProps = useCallback(
    (key: string) => {
      return getInputProps(`${texture}.${key}`);
    },
    [getInputProps, texture],
  );

  const handleDrop = useCallback(
    (src: string) => {
      const srcInput = getTextureProps('src');
      // The component FileUploadField build the asset path with the format: assets/scene/ASSET_CATEGORY/filename.extension
      // The utils fromTexture is adding the basePath again, as the toTexture is removing the basePath, so we need to remove it again
      // TODO: Refactor EntityInspector/MaterialInspector/Texture/utils.ts::fromTexture util to not remove the basePath
      const value = removeBasePath(files?.basePath ?? '', src);
      srcInput?.onChange &&
        srcInput.onChange({
          target: { value },
        } as React.ChangeEvent<HTMLInputElement>);
    },
    [files, texture, getInputProps],
  );

  const isValid = useCallback(
    (value: string | number | readonly string[]) => {
      return isValidTexture(value, files);
    },
    [files],
  );

  const type = getTextureProps('type');

  return (
    <Container
      label={label}
      className={label}
      initialOpen={false}
      border
    >
      <Block>
        <Dropdown
          label="Type"
          options={TEXTURE_TYPES}
          {...type}
        />
      </Block>
      {type.value === Texture.TT_TEXTURE && (
        <NormalTexture
          getTextureProps={getTextureProps}
          handleDrop={handleDrop}
          isValid={isValid}
          files={files}
        />
      )}
      <Block>
        <Dropdown
          label="Wrap mode"
          options={WRAP_MODES}
          {...getTextureProps('wrapMode')}
        />
        <Dropdown
          label="Filter node"
          options={FILTER_MODES}
          {...getTextureProps('filterMode')}
        />
      </Block>
    </Container>
  );
}

function NormalTexture({
  getTextureProps,
  handleDrop,
  isValid,
  files,
}: {
  getTextureProps: (key: string) => ReturnType<Props['getInputProps']>;
  handleDrop: (src: string) => void;
  isValid: (value: string | number | readonly string[]) => boolean;
  files?: Props['files'];
}) {
  const src = getTextureProps('src');

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      // The component FileUploadField build the asset path with the format: assets/scene/ASSET_CATEGORY/filename.extension
      // The utils fromTexture is adding the basePath again, as the toTexture is removing the basePath, so we need to remove it again
      // TODO: Refactor EntityInspector/MaterialInspector/Texture/utils.ts::fromTexture util to not remove the basePath
      const value = removeBasePath(files?.basePath ?? '', event.target.value);
      src?.onChange &&
        src.onChange({
          target: { value },
        } as React.ChangeEvent<HTMLInputElement>);
    },
    [files, src],
  );

  return (
    <>
      <Block>
        <FileUploadField
          {...src}
          label="Path"
          accept={ACCEPTED_FILE_TYPES['image']}
          onDrop={handleDrop}
          onChange={handleChange}
          error={!!src.value && !isValid(src.value)}
          isValidFile={isModel}
          acceptURLs
        />
      </Block>
      <Block label="Offset">
        <TextField
          leftLabel="X"
          type="number"
          {...getTextureProps('offset.x')}
          autoSelect
        />
        <TextField
          leftLabel="Y"
          type="number"
          {...getTextureProps('offset.y')}
          autoSelect
        />
      </Block>
      <Block label="Tiling">
        <TextField
          leftLabel="X"
          type="number"
          {...getTextureProps('tiling.x')}
          autoSelect
        />
        <TextField
          leftLabel="Y"
          type="number"
          {...getTextureProps('tiling.y')}
          autoSelect
        />
      </Block>
    </>
  );
}

export default TextureInspector;
