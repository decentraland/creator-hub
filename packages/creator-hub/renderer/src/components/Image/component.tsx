import { useState, useCallback } from 'react';

import { type Props } from './types';

import './styles.css';

/**
 * Image component that shows a fallback when the primary source fails to load
 */
export function Image({
  src,
  fallbackSrc,
  alt,
  className,
  ...props
}: Props) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    if (!hasError && fallbackSrc) {
      setHasError(true);
      setImgSrc(fallbackSrc);
    }
  }, [hasError, fallbackSrc]);

  // show placeholder if sources failed & no fallback...
  if (hasError && imgSrc === fallbackSrc) {
    return (
      <div className={`image-fallback-placeholder ${className || ''}`}>
        <div className="placeholder-content">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
              fill="currentColor"
            />
          </svg>
          <span className="placeholder-text">{alt}</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      {...props}
    />
  );
}
