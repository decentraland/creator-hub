import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDrop } from 'react-dnd';
import { HiOutlineUpload } from 'react-icons/hi';
import { VscFolderOpened as FolderIcon } from 'react-icons/vsc';
import { MdLink as LinkIcon } from 'react-icons/md';
import cx from 'classnames';

import { getNode, DropTypesEnum, type LocalAssetDrop } from '../../lib/sdk/drag-drop';
import { EXTENSIONS, withAssetDir } from '../../lib/data-layer/host/fs-utils';
import { isValidHttpsUrl } from '../../lib/utils/url';
import { useAssetImport } from '../../hooks/useAssetImport';

import { isModel } from '../EntityInspector/GltfInspector/utils';
import { isAudio } from '../EntityInspector/AudioSourceInspector/utils';
import { isModel as isTexture } from '../EntityInspector/MaterialInspector/Texture/utils';
import { type TreeNode } from '../ProjectAssetExplorer/ProjectView';
import { type AssetNodeItem } from '../ProjectAssetExplorer/types';

import FileInput from '../FileInput';
import type { InputRef } from '../FileInput/FileInput';
import { Modal } from '../Modal';
import { Dropdown } from '../ui/Dropdown';
import { Message, MessageType } from '../ui/Message';
import { Slider } from './Slider';
import { Error } from './Error';
import { UrlInputModal } from './UrlInputModal';

import { ACCEPTED_FILE_TYPES, formatPathOption } from './utils';
import {
  type ImportAssetProps,
  type FieldModeProps,
  type WrapperModeProps,
  isFieldMode,
} from './types';

import './ImportAsset.css';

const ACCEPTED_FILE_TYPES_STR = Object.values(ACCEPTED_FILE_TYPES)
  .flat()
  .join('/')
  .replaceAll('.', '')
  .toUpperCase();

const FieldMode: React.FC<
  FieldModeProps & {
    onStartImport: (files: File[]) => Promise<void>;
    isImportModalOpen: boolean;
  }
> = ({
  value,
  label,
  error,
  className,
  options = [],
  onChange,
  onDrop,
  acceptURLs = false,
  showFileExplorer = true,
  allowCatalogDrop = true,
  isValidFile,
  openFileExplorerOnMount = false,
  disabled,
  accept = EXTENSIONS,
  onStartImport,
  isImportModalOpen,
}) => {
  const [invalidDrop, setInvalidDrop] = useState(false);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (openFileExplorerOnMount && !isImportModalOpen) {
      inputRef.current?.click();
    }
  }, [openFileExplorerOnMount, isImportModalOpen]);

  const notifyChange = useCallback(
    (newValue: string) => {
      onDrop?.(newValue);
      onChange?.({ target: { value: newValue } } as React.ChangeEvent<HTMLInputElement>);
    },
    [onDrop, onChange],
  );

  const isValidNode = useCallback(
    (node: TreeNode): node is AssetNodeItem => {
      return isValidFile ? isValidFile(node) : isModel(node) || isAudio(node) || isTexture(node);
    },
    [isValidFile],
  );

  const [{ canDrop }, drop] = useDrop(
    () => ({
      accept: allowCatalogDrop ? [DropTypesEnum.LocalAsset] : [],
      drop: ({ value, context }: LocalAssetDrop, monitor) => {
        if (monitor.didDrop()) return;

        const node = context.tree.get(value)!;
        const element = getNode(node, context.tree, isValidNode);

        if (element) {
          notifyChange(withAssetDir(element.asset.src));
          setInvalidDrop(false);
        } else {
          setInvalidDrop(true);
        }
      },
      canDrop: ({ value, context }: LocalAssetDrop) => {
        const node = context.tree.get(value)!;
        return !!getNode(node, context.tree, isValidNode);
      },
      collect: monitor => ({ canDrop: monitor.canDrop() }),
    }),
    [isValidNode, notifyChange, allowCatalogDrop],
  );

  const handleDropdownChange = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedValue = Array.isArray(value) ? value[0] : value;
      notifyChange(selectedValue);
    },
    [notifyChange],
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setInvalidDrop(false);
        await onStartImport([file]);
      }
      // reset input to allow re-selecting the same file
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [onStartImport],
  );

  const handleAcceptUrl = useCallback(
    (url: string) => {
      notifyChange(url);
      setIsUrlModalOpen(false);
    },
    [notifyChange],
  );

  // build dropdown options (include current URL value if applicable)
  const dropdownOptions = useMemo(() => {
    let opts = options;

    const currentValue = value?.toString();
    if (acceptURLs && currentValue && isValidHttpsUrl(currentValue)) {
      const hasUrlOption = options.some(opt => opt.value === currentValue);
      if (!hasUrlOption) {
        opts = [{ label: currentValue, value: currentValue }, ...options];
      }
    }

    return opts.map(formatPathOption);
  }, [acceptURLs, value, options]);

  const currentValueStr = value?.toString();
  const initialUrlValue =
    currentValueStr && isValidHttpsUrl(currentValueStr) ? currentValueStr : '';
  const hasError = error || invalidDrop;

  return (
    <>
      <div className={cx('ImportAssetField', className)}>
        <div
          className={cx('ImportAssetFieldContainer', {
            error: hasError,
            disabled,
            droppeable: canDrop,
          })}
        >
          <Dropdown
            ref={drop}
            label={label}
            disabled={disabled}
            options={dropdownOptions}
            value={currentValueStr}
            searchable
            onChange={handleDropdownChange}
          />

          <input
            type="file"
            ref={inputRef}
            onChange={handleFileChange}
            accept={accept.join(',')}
          />

          {acceptURLs && (
            <button
              className="ImportAssetFieldButton"
              onClick={() => setIsUrlModalOpen(true)}
              disabled={disabled}
            >
              <LinkIcon size={16} />
            </button>
          )}

          {showFileExplorer && (
            <button
              className="ImportAssetFieldButton"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
            >
              <FolderIcon size={16} />
            </button>
          )}
        </div>

        {hasError && (
          <Message
            text={error}
            type={MessageType.ERROR}
          />
        )}
      </div>

      {acceptURLs && (
        <UrlInputModal
          isOpen={isUrlModalOpen}
          initialValue={initialUrlValue}
          onClose={() => setIsUrlModalOpen(false)}
          onAccept={handleAcceptUrl}
        />
      )}
    </>
  );
};

interface WrapperModeInternalProps extends WrapperModeProps {
  onStartImport: (files: File[]) => Promise<void>;
  isImportModalOpen: boolean;
  pendingAssetsCount: number;
}

const WrapperMode = React.forwardRef<InputRef, WrapperModeInternalProps>(
  ({ children, disabled, onStartImport, isImportModalOpen, pendingAssetsCount }, ref) => {
    const [isHover, setIsHover] = useState(false);

    const showDropOverlay = pendingAssetsCount === 0 && isHover;

    return (
      <div className={cx('ImportAsset', { ImportAssetHover: isHover })}>
        <FileInput
          ref={ref}
          disabled={isImportModalOpen || disabled}
          onDrop={onStartImport}
          onHover={setIsHover}
          multiple
        >
          {showDropOverlay && (
            <>
              <div className="upload-icon">
                <HiOutlineUpload />
              </div>
              <span className="text">Drop {ACCEPTED_FILE_TYPES_STR} files</span>
            </>
          )}
          <div className={cx('children', { hidden: showDropOverlay })}>{children}</div>
        </FileInput>
      </div>
    );
  },
);

const ImportAsset = React.forwardRef<InputRef, ImportAssetProps>((props, ref) => {
  const isField = isFieldMode(props);
  const multiple = props.multiple ?? !isField;
  const accept = props.accept ?? EXTENSIONS;

  // use a ref to avoid stale closure issues with callbacks
  const propsRef = useRef(props);
  propsRef.current = props;

  const handleImportComplete = useCallback((paths: string[]) => {
    const currentProps = propsRef.current;
    currentProps.onImportComplete?.(paths);

    if (paths.length === 0) return;

    if (isFieldMode(currentProps)) {
      currentProps.onDrop?.(paths[0]);
      currentProps.onChange?.({
        target: { value: paths[0] },
      } as React.ChangeEvent<HTMLInputElement>);
    } else {
      currentProps.onSave?.();
    }
  }, []);

  const {
    isModalOpen,
    isImporting,
    pendingAssets,
    areAssetsValid,
    importError,
    startImport,
    submitImport,
    cancelImport,
    isNameAvailable,
  } = useAssetImport({
    multiple,
    acceptExtensions: accept,
    onImportComplete: handleImportComplete,
  });

  return (
    <>
      {isField ? (
        <FieldMode
          {...(props as FieldModeProps)}
          accept={accept}
          onStartImport={startImport}
          isImportModalOpen={isModalOpen}
        />
      ) : (
        <WrapperMode
          ref={ref}
          {...(props as WrapperModeProps)}
          onStartImport={startImport}
          isImportModalOpen={isModalOpen}
          pendingAssetsCount={pendingAssets.length}
        />
      )}

      <Modal
        isOpen={isModalOpen}
        onRequestClose={cancelImport}
        className="ImportAssetModal"
        overlayClassName="ImportAssetModalOverlay"
      >
        {areAssetsValid ? (
          <Slider
            assets={pendingAssets}
            onSubmit={submitImport}
            isNameAvailable={isNameAvailable}
            isImporting={isImporting}
          />
        ) : (
          <Error
            assets={pendingAssets}
            errorMessage={importError ?? 'Asset failed to import'}
            primaryAction={{ name: 'OK', onClick: cancelImport }}
          />
        )}
      </Modal>
    </>
  );
});

export default ImportAsset;
