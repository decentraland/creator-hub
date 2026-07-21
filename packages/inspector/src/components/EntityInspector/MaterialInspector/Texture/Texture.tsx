import { useCallback } from 'react';
import { withSdk } from '../../../../hoc/withSdk';
import { useVideoPlayerOptions } from '../../../../hooks/sdk/useVideoPlayerOptions';
import { useAssetOptions } from '../../../../hooks/useAssetOptions';
import { Block } from '../../../Block';
import { Container } from '../../../Container';
import { Dropdown, FileUploadField, TextField } from '../../../ui';
import { ACCEPTED_FILE_TYPES } from '../../../ui/FileUploadField/types';
import { isModel, isValidTexture } from './utils';
import { type Props, Texture, TEXTURE_TYPES, WRAP_MODES, FILTER_MODES } from './types';

// Kept separate from the UI Designer's `TextureField` on purpose, despite the
// similar UX (Type dropdown + per-variant editor): this one edits an
// engine-bound Material through `getInputProps` flattened string paths and
// carries sampler fields (wrapMode/filterMode/offset/tiling, no Avatar); that
// one is a controlled `TextureUnion` editor committing via source splices and
// adds the Avatar variant. They share the leaf primitives (ui/Dropdown,
// ui/FileUploadField, ui/TextField, useAssetOptions, useVideoPlayerOptions).
const TextureInspector = withSdk<Props>(({ label, texture, files, getInputProps }) => {
  const videoPlayerOptions = useVideoPlayerOptions();

  const getTextureProps = useCallback(
    (key: string) => {
      return getInputProps(`${texture}.${key}`);
    },
    [getInputProps, texture],
  );

  const handleDrop = useCallback(
    (src: string) => {
      const srcInput = getTextureProps('src');
      const value = src;
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
      {type.value === Texture.TT_VIDEO_TEXTURE && videoPlayerOptions.length > 0 ? (
        <Dropdown
          label="Video Source Entity"
          placeholder="Select a Video Player Entity"
          options={videoPlayerOptions}
          value={getTextureProps('videoPlayerEntity').value}
          searchable
          onChange={getTextureProps('videoPlayerEntity').onChange}
        />
      ) : null}
    </Container>
  );
});

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
  const imageOptions = useAssetOptions(ACCEPTED_FILE_TYPES['image']);
  const src = getTextureProps('src');

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
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
          options={imageOptions}
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
