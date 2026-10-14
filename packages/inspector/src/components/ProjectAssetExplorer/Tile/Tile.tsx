import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AiFillCopy as DuplicateIcon,
  AiFillDelete as DeleteIcon,
  AiOutlineSound as AudioIcon,
} from 'react-icons/ai';
import { IoIosImage as ImageIcon } from 'react-icons/io';
import { IoCubeOutline as ModelIcon, IoVideocamOutline as VideoIcon } from 'react-icons/io5';
import { FaFile as OtherIcon } from 'react-icons/fa';
import {
  MdContentCopy as CopyNameIcon,
  MdOutlineDriveFileRenameOutline as RenameIcon,
  MdOutlineLink as CopyPathIcon,
} from 'react-icons/md';
import { Item as MenuItem } from 'react-contexify';
import { SiTypescript as ScriptIcon } from 'react-icons/si';
import { useDrag } from 'react-dnd';
import cx from 'classnames';
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader';

import {
  transformBinaryToBase64Resource,
  withAssetDir,
} from '../../../lib/data-layer/host/fs-utils';
import { getDataLayerInterface, selectDataLayerRemovingAsset } from '../../../redux/data-layer';
import { useAppSelector } from '../../../redux/hooks';
import { ContextMenu as Menu } from '../../ContexMenu';
import FolderIcon from '../../Icons/Folder';
import { Input } from '../../Input';
import { withContextMenu } from '../../../hoc/withContextMenu';
import { useContextMenu } from '../../../hooks/sdk/useContextMenu';
import { determineAssetType, extractFileExtension } from '../../ImportAsset/utils';
import { guessMimeType } from '../file-ops';
import type { Props } from './types';

import './Tile.css';

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

/** Loads the real file of an image asset so the card can show it as its thumbnail. */
function useImageUrl(path: string, enabled: boolean) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null);
    const dataLayer = getDataLayerInterface();
    dataLayer
      ?.getFile({ path: withAssetDir(path) })
      .then(({ content }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([content], { type: guessMimeType(path) }));
        setUrl(objectUrl);
      })
      .catch(error => console.warn(`Could not load the image ${path}:`, error));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, enabled]);

  return url;
}

export const Tile = withContextMenu<Props>(
  ({
    valueId,
    value,
    getDragContext,
    onClick,
    onSelect,
    onRemove,
    onRename,
    onDuplicate,
    onCopyRelativePath,
    onCopyFileName,
    selected,
    contextMenuId,
    dndType,
    thumbnail,
    thumbnailPending,
  }) => {
    const [editing, setEditing] = useState(false);
    const { handleAction } = useContextMenu();
    const isRemovingAsset = useAppSelector(selectDataLayerRemovingAsset);

    const classification = useMemo(
      () =>
        value?.type === 'asset' ? determineAssetType(extractFileExtension(value.name)[1]) : null,
      [value],
    );
    const imageUrl = useImageUrl(valueId, classification === 'Images');

    const isLoading = useMemo(() => {
      const path = withAssetDir(valueId);
      return !!isRemovingAsset[path];
    }, [valueId, isRemovingAsset]);

    const [, drag] = useDrag(
      () => ({ type: dndType, item: { value: valueId, context: getDragContext() } }),
      [valueId],
    );

    const handleRemove = useCallback(() => onRemove(valueId), [valueId, onRemove]);
    const handleDuplicate = useCallback(() => onDuplicate(valueId), [valueId, onDuplicate]);
    const handleCopyPath = useCallback(
      () => onCopyRelativePath(valueId),
      [valueId, onCopyRelativePath],
    );
    const handleCopyName = useCallback(() => onCopyFileName(valueId), [valueId, onCopyFileName]);
    const handleStartRename = useCallback(() => setEditing(true), []);
    const handleCancelRename = useCallback(() => setEditing(false), []);
    const handleSubmitRename = useCallback(
      (newName: string) => {
        setEditing(false);
        if (newName !== value?.name) onRename(valueId, newName);
      },
      [valueId, value, onRename],
    );

    if (!value) return null;

    const renderThumbnail = () => {
      if (value.type === 'folder') return <FolderIcon />;
      if (imageUrl) {
        return (
          <img
            src={imageUrl}
            alt={value.name}
            draggable={false}
          />
        );
      }
      if (thumbnail) {
        return (
          <img
            src={transformBinaryToBase64Resource(thumbnail)}
            alt={value.name}
            draggable={false}
          />
        );
      }
      switch (classification) {
        case 'Models':
          return <ModelIcon className={cx({ 'thumbnail-pending': thumbnailPending })} />;
        case 'Images':
          return <ImageIcon />;
        case 'Audio':
          return <AudioIcon />;
        case 'Video':
          return <VideoIcon />;
        case 'Scripts':
          return <ScriptIcon />;
        default:
          return <OtherIcon />;
      }
    };

    return (
      <>
        <Menu id={contextMenuId}>
          <MenuItem
            id="rename"
            onClick={handleAction(handleStartRename)}
          >
            <RenameIcon /> Rename
          </MenuItem>
          <MenuItem
            id="duplicate"
            onClick={handleAction(handleDuplicate)}
          >
            <DuplicateIcon /> Duplicate
          </MenuItem>
          <MenuItem
            id="copy-relative-path"
            onClick={handleAction(handleCopyPath)}
          >
            <CopyPathIcon /> Copy relative path
          </MenuItem>
          <MenuItem
            id="copy-file-name"
            onClick={handleAction(handleCopyName)}
          >
            <CopyNameIcon /> Copy file name
          </MenuItem>
          {/* TODO: support removing folders */}
          {value.type === 'asset' && (
            <MenuItem
              id="delete"
              onClick={handleAction(handleRemove)}
            >
              <DeleteIcon /> Delete
            </MenuItem>
          )}
        </Menu>
        <div
          ref={drag}
          className={cx('Tile', { selected })}
          key={value.name}
          onClick={onClick}
          onDoubleClick={onSelect}
          title={value.name}
          data-test-id={valueId}
          data-test-label={value.name}
        >
          {isLoading && (
            <div className="overlay">
              <Loader active />
            </div>
          )}
          {renderThumbnail()}
          {editing ? (
            <div
              className="rename-input"
              onClick={stopPropagation}
              onDoubleClick={stopPropagation}
            >
              <Input
                value={value.name}
                onCancel={handleCancelRename}
                onSubmit={handleSubmitRename}
                onBlur={handleCancelRename}
              />
            </div>
          ) : (
            <span>{value.name}</span>
          )}
        </div>
      </>
    );
  },
);
