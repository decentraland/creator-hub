import { useCallback, useEffect, useMemo, useState } from 'react';
import { AiOutlineSound as AudioIcon } from 'react-icons/ai';
import { IoIosImage as ImageIcon } from 'react-icons/io';
import { IoCubeOutline as ModelIcon, IoVideocamOutline as VideoIcon } from 'react-icons/io5';
import { FaFile as OtherIcon } from 'react-icons/fa';
import { MdContentCopy as CopyNameIcon, MdOutlineEmojiPeople as EmoteIcon } from 'react-icons/md';
import { Item as MenuItem } from 'react-contexify';
import { SiTypescript as ScriptIcon } from 'react-icons/si';
import { useDrag, useDrop } from 'react-dnd';
import cx from 'classnames';
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader';

import {
  transformBinaryToBase64Resource,
  withAssetDir,
} from '../../../lib/data-layer/host/fs-utils';
import {
  copyBuiltInEmoteName,
  notifyBuiltInEmoteNotDraggable,
} from '../../../lib/logic/built-in-emotes';
import { getDataLayerInterface, selectDataLayerRemovingAsset } from '../../../redux/data-layer';
import { useAppSelector } from '../../../redux/hooks';
import { ContextMenu as Menu } from '../../ContexMenu';
import FolderIcon from '../../Icons/Folder';
import { CopyPathIcon, DeleteIcon, DuplicateIcon, RenameIcon } from '../../Icons/ContextMenu';
import { Input } from '../../Input';
import { withContextMenu } from '../../../hoc/withContextMenu';
import { useContextMenu } from '../../../hooks/sdk/useContextMenu';
import { determineAssetType, extractFileExtension } from '../../ImportAsset/utils';
import type { AssetNodeItem } from '../types';
import { isEmoteAsset } from '../utils';
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
    actionCount = 1,
    getDragItems,
    onDropItems,
    selected,
    readOnly,
    contextMenuId,
    dndType,
    thumbnail,
    thumbnailPending,
    getAnimatedThumbnail,
  }) => {
    const [editing, setEditing] = useState(false);
    const [animatedThumbnail, setAnimatedThumbnail] = useState<Uint8Array | null>(null);
    const [hovered, setHovered] = useState(false);
    const { handleAction } = useContextMenu();
    const isRemovingAsset = useAppSelector(selectDataLayerRemovingAsset);

    const classification = useMemo(
      () =>
        value?.type === 'asset' ? determineAssetType(extractFileExtension(value.name)[1]) : null,
      [value],
    );
    const imageUrl = useImageUrl(valueId, classification === 'Images');

    useEffect(() => {
      if (value?.type === 'asset' && getAnimatedThumbnail) {
        getAnimatedThumbnail(value as AssetNodeItem).then(data =>
          setAnimatedThumbnail(data ? data : null),
        );
      }
    }, [value, getAnimatedThumbnail]);

    const isLoading = useMemo(() => {
      const path = withAssetDir(valueId);
      return !!isRemovingAsset[path];
    }, [valueId, isRemovingAsset]);

    const builtInEmote =
      value?.type === 'asset' ? (value as AssetNodeItem).asset.builtInEmote : undefined;
    const canMove = !readOnly && !builtInEmote;

    const [, drag] = useDrag(
      () => ({
        type: dndType,
        canDrag: canMove,
        // `value` is what the viewport and the component inputs read; `items` lets the tree
        // and the folder cards move the whole selection.
        item: () => ({ value: valueId, items: getDragItems(valueId), context: getDragContext() }),
      }),
      [valueId, canMove, getDragItems, getDragContext],
    );

    const isFolder = value?.type === 'folder';
    const [{ isDropTarget }, drop] = useDrop(
      () => ({
        accept: dndType,
        canDrop: (item: { value?: string; items?: string[] }) => {
          const items = item.items ?? (item.value ? [item.value] : []);
          return isFolder && !readOnly && !items.includes(valueId);
        },
        drop: (item: { value?: string; items?: string[] }, monitor) => {
          if (monitor.didDrop()) return;
          onDropItems(item.items ?? (item.value ? [item.value] : []), valueId);
        },
        collect: monitor => ({ isDropTarget: monitor.isOver() && monitor.canDrop() }),
      }),
      [isFolder, readOnly, valueId, onDropItems],
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

    const isMultiple = actionCount > 1;

    const renderThumbnail = () => {
      if (value.type === 'folder') return <FolderIcon />;
      if (builtInEmote) {
        return (
          <img
            src={
              hovered && builtInEmote.previewUrl
                ? builtInEmote.previewUrl
                : builtInEmote.thumbnailUrl
            }
            alt={value.name}
            draggable={false}
          />
        );
      }
      if (imageUrl) {
        return (
          <img
            src={imageUrl}
            alt={value.name}
            draggable={false}
          />
        );
      }
      if (hovered && animatedThumbnail) {
        return (
          <img
            src={transformBinaryToBase64Resource(animatedThumbnail, 'image/webp')}
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
      if (isEmoteAsset((value as AssetNodeItem).asset)) return <EmoteIcon />;
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

    const renderMenu = () => {
      if (builtInEmote) {
        return (
          <MenuItem
            id="copy-name"
            onClick={handleAction(() => copyBuiltInEmoteName(builtInEmote.name))}
          >
            <CopyNameIcon size={16} />
            Copy name
          </MenuItem>
        );
      }
      return (
        <>
          {!readOnly && !isMultiple && (
            <MenuItem
              id="rename"
              onClick={handleAction(handleStartRename)}
            >
              <RenameIcon />
              Rename
            </MenuItem>
          )}
          {!readOnly && (
            <MenuItem
              id="duplicate"
              onClick={handleAction(handleDuplicate)}
            >
              <DuplicateIcon />
              {isMultiple ? `Duplicate ${actionCount} items` : 'Duplicate'}
            </MenuItem>
          )}
          <MenuItem
            id="copy-relative-path"
            onClick={handleAction(handleCopyPath)}
          >
            <CopyPathIcon />
            {isMultiple ? 'Copy Paths' : 'Copy Path'}
          </MenuItem>
          <MenuItem
            id="copy-file-name"
            onClick={handleAction(handleCopyName)}
          >
            <CopyNameIcon size={16} />
            {isMultiple ? 'Copy file names' : 'Copy file name'}
          </MenuItem>
          {!readOnly && (
            <MenuItem
              id="delete"
              onClick={handleAction(handleRemove)}
            >
              <DeleteIcon />
              {isMultiple ? `Delete ${actionCount} items` : 'Delete'}
            </MenuItem>
          )}
        </>
      );
    };

    return (
      <>
        <Menu id={contextMenuId}>{renderMenu()}</Menu>
        <div
          ref={node => drag(drop(node))}
          className={cx('Tile', { selected, 'drop-target': isDropTarget })}
          key={value.name}
          onClick={onClick}
          onDoubleClick={onSelect}
          onDragStart={builtInEmote ? () => notifyBuiltInEmoteNotDraggable(value.name) : undefined}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
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
