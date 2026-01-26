import { useCallback } from 'react';
import { IoIosArrowBack, IoIosArrowForward } from 'react-icons/io';
import cx from 'classnames';

import { AssetPreview } from '../../AssetPreview';
import { Input } from '../../Input';

import { getAssetSize, getAssetResources } from '../utils';
import type { Asset } from '../types';
import type { AssetWithEmote } from './types';

interface AssetSlidesProps {
  uploadedAssets: AssetWithEmote[];
  currentSlide: number;
  onSlideChange: (newSlide: number) => void;
  onScreenshot: (file: Asset) => (thumbnail: string) => void;
  onNameChange: (fileIdx: number) => (newName: string) => void;
  isNameUnique: (asset: Asset) => boolean;
}

export function AssetSlides({
  uploadedAssets,
  currentSlide,
  onSlideChange,
  onScreenshot,
  onNameChange,
  isNameUnique,
}: AssetSlidesProps) {
  const handlePrevClick = useCallback(() => {
    onSlideChange(Math.max(0, currentSlide - 1));
  }, [currentSlide, onSlideChange]);

  const handleNextClick = useCallback(() => {
    onSlideChange(Math.min(uploadedAssets.length - 1, currentSlide + 1));
  }, [currentSlide, uploadedAssets.length, onSlideChange]);

  const manyAssets = uploadedAssets.length > 1;
  const leftArrowDisabled = currentSlide <= 0;
  const rightArrowDisabled = currentSlide >= uploadedAssets.length - 1;

  return (
    <div className="content">
      {manyAssets && (
        <span
          className={cx('left', { disabled: leftArrowDisabled })}
          onClick={handlePrevClick}
        >
          <IoIosArrowBack />
        </span>
      )}
      <div className="slides">
        {uploadedAssets.map(($, i) => (
          <div
            className={cx('asset', { active: currentSlide === i })}
            key={i}
          >
            <div>
              <AssetPreview
                value={$.blob}
                resources={getAssetResources($)}
                onScreenshot={onScreenshot($)}
                isEmote={$.isEmote}
              />
              <Input
                value={$.name}
                onChange={onNameChange(i)}
              />
              {!isNameUnique($) && <span className="name-error">Filename already exists</span>}
            </div>
            <span className="size">{getAssetSize($)}</span>
          </div>
        ))}
      </div>
      {manyAssets && (
        <span
          className={cx('right', { disabled: rightArrowDisabled })}
          onClick={handleNextClick}
        >
          <IoIosArrowForward />
        </span>
      )}
    </div>
  );
}
