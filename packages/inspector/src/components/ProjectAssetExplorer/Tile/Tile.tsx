import { useCallback, useEffect, useMemo, useState } from 'react';
import { AiFillDelete as DeleteIcon, AiOutlineSound as AudioIcon } from 'react-icons/ai';
import { IoIosImage as ImageIcon } from 'react-icons/io';
import { IoCubeOutline as ModelIcon, IoVideocamOutline as VideoIcon } from 'react-icons/io5';
import { FaFile as OtherIcon } from 'react-icons/fa';
import { MdOutlineEmojiPeople as EmoteIcon } from 'react-icons/md';
import { Item as MenuItem } from 'react-contexify';
import { SiTypescript as ScriptIcon } from 'react-icons/si';
import { useDrag } from 'react-dnd';
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
import type { AssetNodeItem } from '../types';
import { isEmoteAsset } from '../utils';
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
  }) => {
    const [thumbnail, setThumbnail] = useState<Uint8Array | null>(null);
    const [animatedThumbnail, setAnimatedThumbnail] = useState<Uint8Array | null>(null);
    const [hovered, setHovered] = useState(false);
    const { handleAction } = useContextMenu();
    const isRemovingAsset = useAppSelector(selectDataLayerRemovingAsset);

    // Load thumbnail when value changes
    useEffect(() => {
      if (value?.type === 'asset' && getThumbnail) {
        getThumbnail(value as AssetNodeItem).then(data => setThumbnail(data ? data : null));
      }
      if (value?.type === 'asset' && getAnimatedThumbnail) {
        getAnimatedThumbnail(value as AssetNodeItem).then(data =>
          setAnimatedThumbnail(data ? data : null),
        );
      }
    }, [value, getThumbnail, getAnimatedThumbnail]);

    const isLoading = useMemo(() => {
      const path = withAssetDir(valueId);
      return !!isRemovingAsset[path];
    }, [valueId, isRemovingAsset]);

    const [, drag] = useDrag(
      () => ({ type: dndType, item: { value: valueId, context: getDragContext() } }),
      [valueId],
    );

    const handleRemove = useCallback(() => {
      onRemove(valueId);
    }, [valueId]);

    if (!value) return null;

    const renderThumbnail = useCallback(() => {
      if (value.type === 'folder') return <FolderIcon />;
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
            src={transformBinaryToBase64Resource(thumbnail)}
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
    }, [thumbnail, animatedThumbnail, hovered, value]);

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
            <MenuItem
              id="delete"
              onClick={handleAction(handleRemove)}
            >
              <DeleteIcon /> Delete
            </MenuItem>
          </Menu>
        )}
        <div
          ref={drag}
          className="Tile"
          key={value.name}
          onDoubleClick={onSelect}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          title={value.name}
          data-test-id={valueId}
          data-test-label={value.name}
        >
          {renderOverlayLoading()}
          {renderThumbnail()}
          <span>{value.name}</span>
        </div>
      </>
    );
  },
);
