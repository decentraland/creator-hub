import React, { useMemo, useState } from 'react';
import { IoColorFillOutline } from 'react-icons/io5';
import type { TextureUnion } from '@dcl/ecs';
import { validateAssetPath } from '@dcl/asset-packs';

import { useAssetOptions } from '../../../../../hooks/useAssetOptions';
import { FileUploadField, RgbaColorField, TextField } from '../../../../ui';
import { ACCEPTED_FILE_TYPES } from '../../../../ui/FileUploadField/types';
import { radioGroupKeyDown, radioTabIndex } from '../radio-group';

import './FillField.css';

/**
 * The Style group's "Fill" control: one mode selector over uiBackground's `color`
 * and `texture`, which it owns together.
 *
 * There is no Video mode. react-ecs flattens PB's `TextureUnion` into `texture` +
 * `avatarTexture` props and drops the video case, so the ceiling is the authoring
 * type rather than the protocol or the renderer (#1434).
 *
 * Kept separate from `EntityInspector/MaterialInspector/Texture` on purpose,
 * despite the similar UX: that one edits an engine-bound Material through
 * `getInputProps` flattened string paths and carries sampler fields
 * (wrapMode/filterMode/offset/tiling, no Avatar); this one is a controlled editor
 * committing via source splices. They share the leaf primitives
 * (ui/RgbaColorField, ui/FileUploadField, ui/TextField, useAssetOptions).
 */

type FillMode = 'colour' | 'file' | 'avatar' | 'none';

type Color4 = { r: number; g: number; b: number; a?: number };

const REACT_ECS_DEFAULT_COLOUR: Color4 = { r: 1, g: 1, b: 1, a: 1 };

const OPAQUE_TINT: Color4 = { r: 1, g: 1, b: 1, a: 1 };

const MODES: { value: FillMode; label: string; hint: string }[] = [
  {
    value: 'colour',
    label: 'Solid colour',
    hint: 'A flat colour fill',
  },
  {
    value: 'file',
    label: 'Image file',
    hint: 'An image asset from your scene',
  },
  {
    value: 'avatar',
    label: 'Avatar',
    hint: 'A player’s avatar snapshot, by user ID',
  },
  {
    value: 'none',
    label: 'No fill',
    hint: 'Nothing painted behind this node',
  },
];

const MODE_VALUES = MODES.map(m => m.value);

interface FillFieldProps {
  color: Color4 | undefined;
  texture: TextureUnion | undefined;
  onPatch: (patch: Record<string, unknown>) => void;
}

/**
 * With nothing authored, several modes are the SAME source state — a path, a
 * userId or a colour is the only thing telling them apart. `picked` remembers an
 * explicit choice until a value lands, which is what keeps that segment selected
 * and its editor on screen in between; anything already in source wins over it.
 */
const FillFieldComponent: React.FC<FillFieldProps> = ({ color, texture, onPatch }) => {
  const assetOptions = useAssetOptions(ACCEPTED_FILE_TYPES.image);
  const imageOptions = useMemo(
    () => [{ label: 'None', value: '' }, ...assetOptions],
    [assetOptions],
  );

  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const [picked, setPicked] = useState<FillMode | undefined>(undefined);

  const tex = texture?.tex;
  const authored: FillMode | undefined =
    tex?.$case === 'avatarTexture' ? 'avatar' : tex ? 'file' : color ? 'colour' : undefined;
  const mode: FillMode = authored ?? picked ?? 'none';

  const handleModeChange = (next: FillMode) => {
    setFileError(undefined);
    setPicked(next);
    if (next === mode) return;
    switch (next) {
      case 'colour':
        onPatch({ texture: undefined, color: color ?? REACT_ECS_DEFAULT_COLOUR });
        break;
      case 'avatar':
        onPatch({
          texture: { tex: { $case: 'avatarTexture', avatarTexture: { userId: '' } } },
          ...(color ? {} : { color: OPAQUE_TINT }),
        });
        break;
      case 'file':
        onPatch({ texture: undefined });
        break;
      case 'none':
      default:
        onPatch({ texture: undefined, color: undefined });
        break;
    }
  };

  const renderVariant = () => {
    switch (mode) {
      case 'none':
        return null;
      case 'colour':
        return (
          <RgbaColorField
            value={color ?? REACT_ECS_DEFAULT_COLOUR}
            onChange={next => onPatch({ color: next })}
          />
        );
      case 'avatar': {
        const userId = tex?.$case === 'avatarTexture' ? tex.avatarTexture.userId : '';
        return (
          <TextField
            label="User ID"
            value={userId}
            onChange={e =>
              onPatch({
                texture: {
                  tex: { $case: 'avatarTexture', avatarTexture: { userId: e.target.value } },
                },
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
            onPatch({ texture: undefined });
            return;
          }
          const pathError = validateAssetPath(path);
          setFileError(pathError ?? undefined);
          if (pathError !== null) return;
          const transparent = !color || (color.a ?? 1) === 0;
          onPatch({
            texture: { tex: { $case: 'texture', texture: { ...(existing ?? {}), src: path } } },
            ...(transparent ? { color: OPAQUE_TINT } : {}),
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
    <div className="ui-designer-fill-field">
      <div
        className="ui-designer-fill-modes"
        role="radiogroup"
        aria-label="Fill type"
        onKeyDown={radioGroupKeyDown(MODE_VALUES, mode, handleModeChange)}
      >
        {MODES.map((m, index) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={m.value === mode}
            aria-label={m.label}
            tabIndex={radioTabIndex(MODE_VALUES, mode, index)}
            className={`ui-designer-fill-mode${m.value === mode ? ' selected' : ''}`}
            title={m.hint}
            data-mode={m.value}
            onClick={() => handleModeChange(m.value)}
          >
            {m.value === 'colour' ? <IoColorFillOutline aria-hidden /> : null}
          </button>
        ))}
      </div>
      {renderVariant()}
    </div>
  );
};

export const FillField = React.memo(FillFieldComponent);
