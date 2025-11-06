import { useCallback, useMemo } from 'react';
import { type Entity } from '@dcl/ecs';
import { withSdk } from '../../../../hoc/withSdk';
import { useEntitiesWith } from '../../../../hooks/sdk/useEntitiesWith';
import { removeBasePath } from '../../../../lib/logic/remove-base-path';
import { Block } from '../../../Block';
import { Container } from '../../../Container';
import { Dropdown, FileUploadField, TextField } from '../../../ui';
import { ACCEPTED_FILE_TYPES } from '../../../ui/FileUploadField/types';
import { isModel, isValidTexture } from './utils';
import {
  type Props,
  Texture,
  TEXTURE_TYPES,
  WRAP_MODES,
  FILTER_MODES,
  type VideoTexture,
} from './types';

const TextureInspector = withSdk<Props>(({ sdk, label, texture, files, getInputProps }) => {
  const { Material, Name } = sdk.components;
  const entitiesWithVideoPlayer: Entity[] = useEntitiesWith(components => components.VideoPlayer);

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

  const availableVideoPlayers: VideoTexture = useMemo(() => {
    const videoPlayers = new Map() as VideoTexture;
    for (const entityWithVideoPlayer of entitiesWithVideoPlayer) {
      const name = Name.getOrNull(entityWithVideoPlayer);
      const material = Material.getOrNull(entityWithVideoPlayer);
      if (name && material) {
        videoPlayers.set(entityWithVideoPlayer, { name: name.value, material });
      }
    }
    return videoPlayers;
  }, [entitiesWithVideoPlayer]);

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
      {type.value === Texture.TT_VIDEO_TEXTURE &&
      availableVideoPlayers &&
      availableVideoPlayers.size > 0 ? (
        <Dropdown
          label="Video Source"
          placeholder="Select a Video Player Entity"
          options={Array.from(availableVideoPlayers.entries()).map(([key, value]) => ({
            label: value.name,
            value: key,
          }))}
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
