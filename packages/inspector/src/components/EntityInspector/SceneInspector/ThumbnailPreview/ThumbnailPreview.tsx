import React, { useCallback, useEffect, useState } from 'react';
import { IoIosImage } from 'react-icons/io';
import cx from 'classnames';

import { useAssetUrl } from '../../../../hooks/useAssetUrl';
import { InfoTooltip } from '../../../ui/InfoTooltip';
import { Message, MessageType } from '../../../ui/Message';
import {
  getThumbnailWarnings,
  THUMBNAIL_RECOMMENDED_HEIGHT,
  THUMBNAIL_RECOMMENDED_WIDTH,
  THUMBNAIL_SAFE_AREA_INSET,
} from '../utils';
import type { ThumbnailDimensions } from '../utils';

import './ThumbnailPreview.css';

const DOCS_URL =
  'https://docs.decentraland.org/creator/scenes-sdk7/kinds-of-projects/scene-metadata#scene-thumbnail';

const GUIDANCE =
  `Use a .png or .jpg image with a 16:9 aspect ratio, ideally ${THUMBNAIL_RECOMMENDED_WIDTH}×${THUMBNAIL_RECOMMENDED_HEIGHT}px. ` +
  'Other sizes are stretched to 16:9. Some parts of the platform show only the central square ' +
  `(${THUMBNAIL_RECOMMENDED_HEIGHT}×${THUMBNAIL_RECOMMENDED_HEIGHT} of a ${THUMBNAIL_RECOMMENDED_WIDTH}×${THUMBNAIL_RECOMMENDED_HEIGHT} image): ` +
  'the shaded sides are cut off there, so keep text and logos out of them.';

const LOAD_ERROR = 'The thumbnail image could not be loaded.';

type Props = {
  path: string;
};

const ThumbnailPreviewComponent: React.FC<Props> = ({ path }) => {
  const url = useAssetUrl(path || undefined);
  const [dimensions, setDimensions] = useState<ThumbnailDimensions | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setDimensions(null);
    setFailed(false);
  }, [url]);

  const handleLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    setDimensions({ width: naturalWidth, height: naturalHeight });
  }, []);

  const handleError = useCallback(() => setFailed(true), []);

  const warnings = url ? getThumbnailWarnings(path, dimensions) : [];
  if (failed) warnings.push(LOAD_ERROR);
  const showCrop = !!url && !!dimensions && !failed;

  return (
    <div className="ThumbnailPreview">
      <div
        className={cx('ThumbnailPreviewFrame', { empty: !url || failed })}
        style={
          {
            '--thumbnail-safe-area-inset': `${THUMBNAIL_SAFE_AREA_INSET * 100}%`,
          } as React.CSSProperties
        }
      >
        {url && !failed ? (
          <img
            src={url}
            alt="Scene thumbnail"
            onLoad={handleLoad}
            onError={handleError}
          />
        ) : (
          <IoIosImage />
        )}
        {showCrop ? (
          <>
            <span
              className="ThumbnailCrop left"
              aria-hidden
            />
            <span
              className="ThumbnailCrop right"
              aria-hidden
            />
          </>
        ) : null}
      </div>
      <div className="ThumbnailPreviewCaption">
        <span className="ThumbnailPreviewDimensions">
          {dimensions && !failed ? `${dimensions.width} × ${dimensions.height}` : null}
        </span>
        <InfoTooltip
          text={GUIDANCE}
          link={DOCS_URL}
        />
      </div>
      {warnings.map(warning => (
        <Message
          key={warning}
          text={warning}
          type={MessageType.WARNING}
        />
      ))}
    </div>
  );
};

const ThumbnailPreview = React.memo(ThumbnailPreviewComponent);

export { ThumbnailPreview };
export default ThumbnailPreview;
