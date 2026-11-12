import React, { useCallback } from 'react';

import { useAssetOptions } from '../../../../hooks/useAssetOptions';
import ImportAsset from '../../../ImportAsset';
import type { TreeNode } from '../../../ProjectAssetExplorer/ProjectView';
import { isAssetNode } from '../../../ProjectAssetExplorer/utils';
import { ACCEPTED_FILE_TYPES } from '../../../ui/FileUploadField/types';
import type { ScriptFileFormat } from '../types';

type Props = {
  label: React.ReactNode;
  value: string;
  format: ScriptFileFormat;
  disabled?: boolean;
  onChange: (path: string) => void;
};

const hasExtension = (path: string, extensions: string[]) =>
  extensions.some(extension => path.toLowerCase().endsWith(extension));

// A string param tagged `@format image` (or audio, video, model): picks a scene file of that kind
// from a dropdown, the file tree or the disk, as the Material texture and AudioSource fields do.
export function FileParamField({ label, value, format, disabled, onChange }: Props) {
  const accept = ACCEPTED_FILE_TYPES[format];
  const options = useAssetOptions(accept);
  const isValidFile = useCallback(
    (node: TreeNode) => isAssetNode(node) && hasExtension(node.name, accept),
    [accept],
  );

  return (
    <ImportAsset
      mode="field"
      label={label}
      value={value}
      disabled={disabled}
      accept={accept}
      options={options}
      isValidFile={isValidFile}
      error={value && !hasExtension(value, accept) ? 'Invalid file type' : undefined}
      onChange={e => onChange(e.target.value)}
    />
  );
}
