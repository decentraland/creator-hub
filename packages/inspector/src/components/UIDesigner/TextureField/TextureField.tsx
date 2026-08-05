import React, { useMemo, useState } from 'react';
import { IoBanOutline, IoImageOutline, IoPersonOutline } from 'react-icons/io5';
import type { TextureUnion } from '@dcl/ecs';
import { validateAssetPath } from '@dcl/asset-packs';

import { useAssetOptions } from '../../../hooks/useAssetOptions';
import { FileUploadField, TextField } from '../../ui';
import { ACCEPTED_FILE_TYPES } from '../../ui/FileUploadField/types';

import './TextureField.css';

// Kept separate from `EntityInspector/MaterialInspector/Texture` on purpose,
// despite the similar UX (Type dropdown + per-variant editor): that one edits
// an engine-bound Material through `getInputProps` flattened string paths and
// carries sampler fields (wrapMode/filterMode/offset/tiling, no Avatar); this
// one is a controlled `TextureUnion` editor committing via source splices and
// adds the Avatar variant. They share the leaf primitives (ui/Dropdown,
// ui/FileUploadField, ui/TextField, useAssetOptions).

// The design's mode row: None / File / Avatar as icon segments. No Video mode —
// react-ecs flattens PB's TextureUnion into `texture` + `avatarTexture` props and
// drops the video case. PB and the renderer support it; the authoring type doesn't
// (#1434).
type TexMode = 'none' | 'file' | 'avatar';

const MODES: { value: TexMode; label: string; icon: React.ReactNode; hint: string }[] = [
  {
    value: 'none',
    label: 'No texture',
    icon: <IoBanOutline aria-hidden />,
    hint: 'No texture — the background is the solid colour alone',
  },
  {
    value: 'file',
    label: 'Image file',
    icon: <IoImageOutline aria-hidden />,
    hint: 'An image asset from your scene',
  },
  {
    value: 'avatar',
    label: 'Avatar',
    icon: <IoPersonOutline aria-hidden />,
    hint: 'A player’s avatar snapshot, by user ID',
  },
];

interface TextureFieldProps {
  value: TextureUnion | undefined;
  onChange: (next: TextureUnion | undefined) => void;
}

const TextureFieldComponent: React.FC<TextureFieldProps> = ({ value, onChange }) => {
  const assetOptions = useAssetOptions(ACCEPTED_FILE_TYPES.image);
  const imageOptions = useMemo(
    () => [{ label: 'None', value: '' }, ...assetOptions],
    [assetOptions],
  );

  const [fileError, setFileError] = useState<string | undefined>(undefined);
  // With nothing set, "None" and "File" are the SAME source state — a path is the
  // only thing that tells them apart. So an explicit File pick is remembered here
  // until one lands, which is what keeps its segment selected (and the picker on
  // screen) in between.
  const [wantsFile, setWantsFile] = useState(false);

  const tex = value?.tex;
  const mode: TexMode =
    tex?.$case === 'avatarTexture' ? 'avatar' : tex ? 'file' : wantsFile ? 'file' : 'none';

  const handleModeChange = (next: TexMode) => {
    setFileError(undefined);
    setWantsFile(next === 'file');
    if (next === mode) return;
    if (next === 'avatar') {
      onChange({ tex: { $case: 'avatarTexture', avatarTexture: { userId: '' } } });
    } else {
      onChange(undefined);
    }
  };

  const renderVariant = () => {
    switch (mode) {
      case 'none':
        return null;
      case 'avatar': {
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
      case 'file':
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
      <div
        className="ui-designer-texture-modes"
        role="radiogroup"
        aria-label="Texture type"
      >
        {MODES.map(m => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={m.value === mode}
            aria-label={m.label}
            className={`ui-designer-texture-mode${m.value === mode ? ' selected' : ''}`}
            title={m.hint}
            onClick={() => handleModeChange(m.value)}
          >
            {m.icon}
          </button>
        ))}
      </div>
      {renderVariant()}
    </div>
  );
};

export const TextureField = React.memo(TextureFieldComponent);
