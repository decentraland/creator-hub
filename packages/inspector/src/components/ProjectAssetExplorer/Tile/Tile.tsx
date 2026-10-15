import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AiFillDelete as DeleteIcon,
  AiOutlineCopy as CopyIcon,
  AiOutlineSound as AudioIcon,
} from 'react-icons/ai';
import { IoIosImage as ImageIcon } from 'react-icons/io';
import { IoCubeOutline as ModelIcon, IoVideocamOutline as VideoIcon } from 'react-icons/io5';
import { FaFile as OtherIcon } from 'react-icons/fa';
import { MdOutlineEmojiPeople as EmoteIcon } from 'react-icons/md';
import { Item as MenuItem } from 'react-contexify';
import { SiTypescript as ScriptIcon } from 'react-icons/si';
import { useDrag } from 'react-dnd';
import cx from 'classnames';
import { Loader } from 'decentraland-ui/dist/components/Loader/Loader';

import {
  transformBinaryToBase64Resource,
  withAssetDir,
} from '../../../lib/data-layer/host/fs-utils';
import { useAppSelector } from '../../../redux/hooks';
import { selectDataLayerRemovingAsset } from '../../../redux/data-layer';
import { ContextMenu as Menu } from '../../ContexMenu';
import FolderIcon from '../../Icons/Folder';
import { withContextMenu } from '../../../hoc/withContextMenu';
import { useContextMenu } from '../../../hooks/sdk/useContextMenu';
import { determineAssetType, extractFileExtension } from '../../ImportAsset/utils';
import { useAssetSelection, useIsAssetSelected } from '../../AssetBrowserPreview';
import type { AssetNodeItem } from '../types';
import { isEmoteAsset } from '../utils';
import { copyBuiltInEmoteName } from '../../../lib/logic/built-in-emotes';
import type { Props } from './types';

import './Tile.css';

export const Tile = withContextMenu<Props>(
  ({
    valueId,
    value,
    getDragContext,
    onSelect,
    onRemove,
    contextMenuId,
    dndType,
    getThumbnail,
    getAnimatedThumbnail,
    layout = 'grid',
    showPath = false,
  }) => {
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [animatedThumbnail, setAnimatedThumbnail] = useState<Uint8Array | null>(null);
    const [hovered, setHovered] = useState(false);
    const { handleAction } = useContextMenu();
    const isRemovingAsset = useAppSelector(selectDataLayerRemovingAsset);
    const { select } = useAssetSelection();
    const isSelected = useIsAssetSelected('local', valueId);

    // Load thumbnail when value changes
    useEffect(() => {
      if (value?.type !== 'asset') return;
      let cancelled = false;
      if (getThumbnail) {
        getThumbnail(value as AssetNodeItem).then(url => {
          if (!cancelled) setThumbnail(url ?? null);
        });
      }
      if (getAnimatedThumbnail) {
        getAnimatedThumbnail(value as AssetNodeItem).then(data => {
          if (!cancelled) setAnimatedThumbnail(data ?? null);
        });
      }
      return () => {
        cancelled = true;
      };
    }, [value, getThumbnail, getAnimatedThumbnail]);

    const isLoading = useMemo(() => {
      const path = withAssetDir(valueId);
      return !!isRemovingAsset[path];
    }, [valueId, isRemovingAsset]);

    const builtInEmote =
      value?.type === 'asset' ? (value as AssetNodeItem).asset.builtInEmote : undefined;

    // Built-in animations have no file, so there is nothing to drop into the scene.
    const [, drag] = useDrag(
      () => ({
        type: dndType,
        item: { value: valueId, context: getDragContext() },
        canDrag: !builtInEmote,
      }),
      [valueId, builtInEmote],
    );

    const folderPath = valueId.includes('/') ? valueId.slice(0, valueId.lastIndexOf('/')) : '';

    const handleRemove = useCallback(() => {
      onRemove(valueId);
    }, [valueId]);

    const handleClick = useCallback(() => {
      if (value?.type !== 'asset') return;
      select({ source: 'local', id: valueId, name: value.name, path: valueId, builtInEmote });
    }, [select, value, valueId, builtInEmote]);

    if (!value) return null;

    const renderThumbnail = useCallback(() => {
      if (value.type === 'folder') return <FolderIcon />;
      if (builtInEmote)
        return (
          <img
            src={
              hovered && builtInEmote.previewUrl
                ? builtInEmote.previewUrl
                : builtInEmote.thumbnailUrl
            }
            alt={value.name}
          />
        );
      if (hovered && animatedThumbnail)
        return (
          <img
            src={transformBinaryToBase64Resource(animatedThumbnail, 'image/webp')}
            alt={value.name}
          />
        );
      if (thumbnail)
        return (
          <img
            src={thumbnail}
            alt={value.name}
          />
        );
      if (isEmoteAsset((value as AssetNodeItem).asset)) return <EmoteIcon />;
      const classification = determineAssetType(extractFileExtension(value.name)[1]);
      switch (classification) {
        case 'Models':
          return <ModelIcon />;
        case 'Images':
          return <ImageIcon />;
        case 'Audio':
          return <AudioIcon />;
        case 'Video':
          return <VideoIcon />;
        case 'Scripts':
          return <ScriptIcon />;
        case 'Other':
          return <OtherIcon />;
      }
    }, [thumbnail, animatedThumbnail, hovered, value, builtInEmote]);

    const renderOverlayLoading = useCallback(() => {
      if (isLoading) {
        return (
          <div className="overlay">
            <Loader active />
          </div>
        );
      }

      return null;
    }, [isLoading]);

    return (
      <>
        {/* TODO: support removing folders */}
        {value.type === 'asset' && (
          <Menu id={contextMenuId}>
            {builtInEmote ? (
              <MenuItem
                id="copy-name"
                onClick={handleAction(() => copyBuiltInEmoteName(builtInEmote.name))}
              >
                <CopyIcon /> Copy name
              </MenuItem>
            ) : (
              <MenuItem
                id="delete"
                onClick={handleAction(handleRemove)}
              >
                <DeleteIcon /> Delete
              </MenuItem>
            )}
          </Menu>
        )}
        <div
          ref={drag}
          className={cx('Tile', {
            selected: isSelected,
            folder: value.type === 'folder',
            row: value.type === 'asset' && layout === 'list',
          })}
          key={value.name}
          onClick={handleClick}
          onDoubleClick={onSelect}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          title={showPath ? valueId : value.name}
          data-test-id={valueId}
          data-test-label={value.name}
        >
          {renderOverlayLoading()}
          {renderThumbnail()}
          <span>{value.name}</span>
          {showPath && value.type === 'asset' && layout === 'list' && folderPath && (
            <small className="Tile-path">{folderPath}</small>
          )}
        </div>
      </>
    );
  },
);
