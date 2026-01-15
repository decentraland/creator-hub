import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDrop } from 'react-dnd';
import { VscFolderOpened as FolderIcon } from 'react-icons/vsc';
import cx from 'classnames';
import { v4 as uuidv4 } from 'uuid';

import { selectAssetCatalog } from '../../../redux/app';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { importAsset } from '../../../redux/data-layer';
import { getNode, DropTypesEnum, type LocalAssetDrop } from '../../../lib/sdk/drag-drop';
import { DIRECTORY, EXTENSIONS, withAssetDir } from '../../../lib/data-layer/host/fs-utils';
import { isValidHttpsUrl } from '../../../lib/utils/url';

import { buildAssetPath, convertAssetToBinary, processAssets } from '../../ImportAsset/utils';
import { isModel } from '../../EntityInspector/GltfInspector/utils';
import { isAudio } from '../../EntityInspector/AudioSourceInspector/utils';
import { isModel as isTexture } from '../../EntityInspector/MaterialInspector/Texture/utils';
import { type TreeNode } from '../../ProjectAssetExplorer/ProjectView';
import { type AssetNodeItem } from '../../ProjectAssetExplorer/types';

import { TextField } from '../TextField';

import { type Props } from './types';

import './FileUploadField.css';

function parseAccept(accept: string[]) {
  return accept.join(',');
}

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
  accept = EXTENSIONS,
  openFileExplorerOnMount = false,
}) => {
  const [path, setPath] = useState<string | undefined>(value?.toString());
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [dropError, setDropError] = useState<boolean>(false);
  const [pendingUpload, setPendingUpload] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const files = useAppSelector(selectAssetCatalog);
  const dispatch = useAppDispatch();
  const id = useRef(uuidv4());
  const assetsRefBeforeImport = useRef<unknown>(null);

  useEffect(() => {
    setPath(value?.toString());
    if (openFileExplorerOnMount) {
      handleClick();
    }
  }, [value, openFileExplorerOnMount]);

  useEffect(() => {
    if (!pendingUpload || !files?.assets) return;

    const fileExists = files.assets.some(
      asset => asset.path === pendingUpload && accept.some(ext => asset.path.endsWith(ext)),
    );

    const catalogRefreshed =
      !!assetsRefBeforeImport.current && files.assets !== assetsRefBeforeImport.current;

    if (fileExists && catalogRefreshed) {
      const assetPath = pendingUpload;
      setPendingUpload(null);
      assetsRefBeforeImport.current = null;
      setPath(assetPath);
      onDrop?.(assetPath);
      onChange?.({ target: { value: assetPath } } as React.ChangeEvent<HTMLInputElement>);
    }
  }, [files, pendingUpload, accept, onDrop, onChange]);

  const removeBase = useCallback(
    (path?: string) => {
      return path ? (files?.basePath ? path.replace(files.basePath + '/', '') : path) : '';
    },
    [files],
  );

  const addBase = useCallback(
    (path: string) => {
      return files?.basePath ? `${files.basePath}/${path}` : path;
    },
    [files],
  );

  const handleDrop = useCallback(
    (src: string) => {
      setPath(src);
      onDrop && onDrop(src);
      onChange && onChange({ target: { value: src } } as React.ChangeEvent<HTMLInputElement>);
    },
    [onDrop],
  );

  const isValid = useCallback(
    (node: TreeNode): node is AssetNodeItem => {
      return isValidFile ? isValidFile(node) : isModel(node) || isAudio(node) || isTexture(node);
    },
    [isValidFile],
  );

  const isValidFileName = useCallback(
    (fileName: string = '') => {
      return accept.find(ext => fileName.endsWith(ext));
    },
    [accept],
  );

  const [{ canDrop }, drop] = useDrop(
    () => ({
      accept: [DropTypesEnum.LocalAsset],
      drop: ({ value, context }: LocalAssetDrop, monitor) => {
        if (monitor.didDrop()) return;
        const node = context.tree.get(value)!;
        const element = getNode(node, context.tree, isValid);
        if (element) {
          handleDrop(withAssetDir(element.asset.src));
          setDropError(false);
          setErrorMessage(undefined);
        } else {
          setDropError(true);
        }
      },
      canDrop: ({ value, context }: LocalAssetDrop) => {
        const node = context.tree.get(value)!;
        return !!getNode(node, context.tree, isValid);
      },
      collect: monitor => ({
        isHover: monitor.canDrop() && monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [isValid, handleDrop],
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, [inputRef]);

  const handleChangeTextField = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      if (!value || isValidFileName(value) || (acceptURLs && isValidHttpsUrl(value))) {
        // The value is a valid file name or a valid https url or it's empty (valid as the field is optional).
        const formattedValue = value && !isValidHttpsUrl(value) ? addBase(value) : value; // Add base only if it's a file path.
        event.target.value = formattedValue;
        setPath(formattedValue);
        onChange && onChange(event);
        setDropError(false);
        setErrorMessage(undefined);
      } else if (value) {
        setDropError(true);
        setErrorMessage(
          acceptURLs && !isValidHttpsUrl(value)
            ? 'Provide a https URL or a valid file path'
            : 'File not valid.',
        );
      }
    },
    [addBase, acceptURLs, onChange, isValidFileName],
  );

  const handleChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && isValidFileName(file.name)) {
        setDropError(false);
        setErrorMessage(undefined);

        const [newAsset] = await processAssets([file]);
        const basePath = withAssetDir(DIRECTORY.SCENE);
        const assetPackageName = buildAssetPath(newAsset);
        const content = await convertAssetToBinary(newAsset);
        const assetPath = `${basePath}/${assetPackageName}/${newAsset.name}.${newAsset.extension}`;

        assetsRefBeforeImport.current = files?.assets;

        dispatch(
          importAsset({
            content,
            basePath,
            assetPackageName,
            reload: true,
          }),
        );
        setPendingUpload(assetPath);
      } else {
        setDropError(true);
      }
      if (inputRef.current) inputRef.current.value = '';
    },
    [dispatch, isValidFileName, files?.assets],
  );

  const hasError = useMemo(() => {
    return error || errorMessage || dropError;
  }, [error, errorMessage, dropError]);

  return (
    <div className={cx('FileUpload Field', className)}>
      <div
        className={cx('FileUploadContainer', { error: hasError, disabled, droppeable: canDrop })}
      >
        <TextField
          id={id.current}
          className="FileUploadInput"
          ref={drop}
          placeholder={acceptURLs ? 'https://... or File Path' : 'File Path'}
          label={label}
          onChange={handleChangeTextField}
          value={removeBase(path)}
          error={hasError ? error || errorMessage || 'File not valid.' : undefined}
          disabled={disabled}
          debounceTime={200}
          autoSelect
        />
        <input
          type="file"
          ref={inputRef}
          onChange={handleChange}
          accept={parseAccept(accept)}
        />
        {isEnabledFileExplorer && (
          <button
            className="FileUploadButton"
            onClick={handleClick}
            disabled={disabled}
          >
            <FolderIcon size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(FileUploadField);
