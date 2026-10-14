import React, { useEffect } from 'react';
import { useDrag, DragPreviewImage } from 'react-dnd';
import { BsFillLightningChargeFill as SmartItemIcon } from 'react-icons/bs';
import cx from 'classnames';

import {
  getAnimatedPreviewUrl,
  getBuiltInEmote,
  getContentsUrl,
  isSmart,
  isGround,
} from '../../../lib/logic/catalog';
import { Asset } from '../../../lib/logic/catalog';
import { fetchImage, resizeImage } from '../../../lib/utils/img';
import { useIsMounted } from '../../../hooks/useIsMounted';
import { useAssetSelection, useIsAssetSelected } from '../../AssetBrowserPreview';
import { openCatalogAssetContextMenu } from './ContextMenu/ContextMenu';

import './Asset.css';

type AssetProps = {
  value: Asset;
  onAddToFilesystem?: (asset: Asset) => void;
};

const Asset = React.forwardRef<HTMLDivElement, AssetProps>(({ value, onAddToFilesystem }, ref) => {
  const { select } = useAssetSelection();
  const isSelected = useIsAssetSelected('catalog', value.id);
  const builtInEmote = getBuiltInEmote(value);
  // A built-in animation is already in every scene, so there is nothing to drop.
  const [, drag, preview] = useDrag(
    () => ({ type: 'catalog-asset', item: { value }, canDrag: !builtInEmote }),
    [value, builtInEmote],
  );
  const isSmartItem = isSmart(value);
  const isGroundItem = isGround(value);
  const imgSrc = getContentsUrl(value.contents['thumbnail.png']);
  const animatedSrc = getAnimatedPreviewUrl(value);
  const [hovered, setHovered] = React.useState(false);

  // generate drag preview as a 60x60 data url image
  const [previewImg, setPreviewImg] = React.useState<string>();
  const isMounted = useIsMounted();
  useEffect(() => {
    void fetchImage(`${imgSrc}?resize`)
      .then(img => resizeImage(img, 60, 60))
      .then(canvas => isMounted() && setPreviewImg(canvas.toDataURL()));
  }, [imgSrc, setPreviewImg, isMounted]);

  const handleContextMenu = (event: React.MouseEvent) => {
    if (!onAddToFilesystem && !builtInEmote) return;
    openCatalogAssetContextMenu(event, {
      asset: value,
      onAddToFilesystem,
    });
  };

  return (
    <div ref={ref}>
      {previewImg && (
        <DragPreviewImage
          connect={preview}
          src={previewImg}
        />
      )}
      <div
        className={cx('assets-catalog-asset', {
          'smart-item': isSmartItem,
          ground: isGroundItem,
          selected: isSelected,
          'built-in': !!builtInEmote,
        })}
        ref={drag}
        onClick={() => select({ source: 'catalog', id: value.id, name: value.name, asset: value })}
        data-test-id={value.id}
        data-test-label={value.name}
        onContextMenu={handleContextMenu}
        onMouseEnter={animatedSrc ? () => setHovered(true) : undefined}
        onMouseLeave={animatedSrc ? () => setHovered(false) : undefined}
      >
        <img
          src={hovered && animatedSrc ? animatedSrc : imgSrc}
          alt={value.tags.join(', ')}
        />
        {isSmartItem && (
          <div className="smart-item-badge item-badge">
            <SmartItemIcon />
          </div>
        )}
        {isGroundItem && <div className="ground-badge item-badge"></div>}
        {builtInEmote && <div className="built-in-badge">Built-in</div>}
      </div>
    </div>
  );
});

Asset.displayName = 'Asset';

export default React.memo(Asset);
