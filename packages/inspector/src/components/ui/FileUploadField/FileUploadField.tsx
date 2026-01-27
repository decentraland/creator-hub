import React from 'react';

import ImportAsset from '../../ImportAsset';

import { type Props } from './types';

/**
 * FileUploadField is now a thin wrapper around ImportAsset in field mode.
 * It maintains backward compatibility with the existing API.
 *
 * @deprecated Use `<ImportAsset mode="field" ... />` directly instead.
 */
const FileUploadField: React.FC<Props> = ({
  className,
  disabled,
  value,
  isEnabledFileExplorer = true,
  error,
  label,
  onDrop,
  onChange,
  isValidFile,
  acceptURLs = false,
  accept,
  openFileExplorerOnMount = false,
  options = [],
}) => {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const normalizedError = typeof error === 'boolean' ? (error ? 'Invalid' : undefined) : error;
  const normalizedLabel = typeof label === 'string' ? label : undefined;

  return (
    <ImportAsset
      mode="field"
      className={className}
      disabled={disabled}
      value={normalizedValue}
      showFileExplorer={isEnabledFileExplorer}
      error={normalizedError}
      label={normalizedLabel}
      onDrop={onDrop}
      onChange={onChange}
      isValidFile={isValidFile}
      acceptURLs={acceptURLs}
      accept={accept}
      openFileExplorerOnMount={openFileExplorerOnMount}
      options={options}
    />
  );
};

export default React.memo(FileUploadField);
