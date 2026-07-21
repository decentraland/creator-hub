import React, { useState } from 'react';
import type { TextureUnion } from '@dcl/ecs';
import { validateAssetPath } from '@dcl/asset-packs';

import { useVideoPlayerOptions } from '../../../hooks/sdk/useVideoPlayerOptions';
import { useAssetOptions } from '../../../hooks/useAssetOptions';
import { Dropdown, FileUploadField, TextField } from '../../ui';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';

import './TextureField.css';

// Kept separate from `EntityInspector/MaterialInspector/Texture` on purpose,
// despite the similar UX (Type dropdown + per-variant editor): that one edits
// an engine-bound Material through `getInputProps` flattened string paths and
// carries sampler fields (wrapMode/filterMode/offset/tiling, no Avatar); this
// one is a controlled `TextureUnion` editor committing via source splices and
// adds the Avatar variant. They share the leaf primitives (ui/Dropdown,
// ui/FileUploadField, ui/TextField, useAssetOptions, useVideoPlayerOptions).

type TexCase = 'texture' | 'avatarTexture' | 'videoTexture';

const TYPE_OPTIONS: { value: TexCase; label: string }[] = [
  { value: 'texture', label: 'File' },
  { value: 'avatarTexture', label: 'Avatar' },
  { value: 'videoTexture', label: 'Video' },
];

interface TextureFieldProps {
  value: TextureUnion | undefined;
  onChange: (next: TextureUnion | undefined) => void;
}

const TextureFieldComponent: React.FC<TextureFieldProps> = ({ value, onChange }) => {
  const imageOptions = useAssetOptions(ACCEPTED_FILE_TYPES.image);
  const videoPlayerOptions = useVideoPlayerOptions();

  const [fileError, setFileError] = useState<string | undefined>(undefined);

  const tex = value?.tex;
  const activeCase: TexCase = tex?.$case ?? 'texture';

  const handleTypeChange = (next: TexCase) => {
    setFileError(undefined);
    if (next === activeCase) return;
    switch (next) {
      case 'avatarTexture':
        onChange({ tex: { $case: 'avatarTexture', avatarTexture: { userId: '' } } });
        return;
      case 'videoTexture': {
        const first = videoPlayerOptions[0];
        onChange({
          tex: {
            $case: 'videoTexture',
            videoTexture: { videoPlayerEntity: first ? Number(first.value) : 0 },
          },
        });
        return;
      }
      case 'texture':
      default:
        onChange(undefined);
    }
  };

  const renderVariant = () => {
    switch (activeCase) {
      case 'avatarTexture': {
        const userId = tex?.$case === 'avatarTexture' ? tex.avatarTexture.userId : '';
        return (
          <TextField
            label="User ID"
            value={userId}
            onChange={e =>
              onChange({
                tex: { $case: 'avatarTexture', avatarTexture: { userId: e.target.value } },
              })
            }
          />
        );
      }
      case 'videoTexture': {
        const selected =
          tex?.$case === 'videoTexture' ? String(tex.videoTexture.videoPlayerEntity) : '';
        const hasOptions = videoPlayerOptions.length > 0;
        return (
          <Dropdown
            label="Video player"
            placeholder={hasOptions ? 'Select a video player' : 'No video players in scene'}
            disabled={!hasOptions}
            options={videoPlayerOptions}
            value={selected}
            searchable
            onChange={e =>
              onChange({
                tex: {
                  $case: 'videoTexture',
                  videoTexture: { videoPlayerEntity: Number(e.target.value) },
                },
              })
            }
          />
        );
      }
      case 'texture':
      default: {
        const existing = tex?.$case === 'texture' ? tex.texture : undefined;
        const src = existing?.src ?? '';
        const commit = (path: string) => {
          if (path === '') {
            setFileError(undefined);
            onChange(undefined);
            return;
          }
          const pathError = validateAssetPath(path);
          setFileError(pathError ?? undefined);
          if (pathError !== null) return;
          onChange({
            tex: { $case: 'texture', texture: { ...(existing ?? {}), src: path } },
          });
        };
        return (
          <FileUploadField
            label="Path"
            value={src}
            error={fileError}
            accept={ACCEPTED_FILE_TYPES.image}
            options={imageOptions}
            acceptURLs
            onDrop={commit}
            onChange={e => commit(e.target.value)}
          />
        );
      }
    }
  };

  return (
    <div className="ui-designer-texture-field">
      <Dropdown
        label="Type"
        options={TYPE_OPTIONS}
        value={activeCase}
        onChange={e => handleTypeChange(e.target.value as TexCase)}
      />
      {renderVariant()}
    </div>
  );
};

export const TextureField = React.memo(TextureFieldComponent);
