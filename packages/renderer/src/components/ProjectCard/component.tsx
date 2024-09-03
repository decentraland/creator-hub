import { Dropdown } from '../Dropdown';

import type { Props } from './types';

import './styles.css';
import { useCallback } from 'react';

export function ProjectCard({
  title,
  description,
  imageUrl,
  videoUrl,
  content,
  dropdownOptions,
  width = 256,
  height = 240,
  onClick,
}: Props) {
  const handleMouseEnterVideo = useCallback(
    ({ currentTarget: video }: React.MouseEvent<HTMLVideoElement>) => {
      video.play();
    },
    [],
  );

  const handleMouseLeaveVideo = useCallback(
    ({ currentTarget: video }: React.MouseEvent<HTMLVideoElement>) => {
      video.pause();
      video.currentTime = 0;
    },
    [],
  );

  return (
    <div
      className="ProjectCard"
      onClick={onClick}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {videoUrl ? (
        <video
          className="video"
          src={videoUrl}
          onMouseEnter={handleMouseEnterVideo}
          onMouseLeave={handleMouseLeaveVideo}
        />
      ) : (
        <div
          className="thumbnail"
          style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : {}}
        />
      )}
      <div className="info">
        <div className="title">
          <h2>{title}</h2>
          {dropdownOptions?.length && (
            <Dropdown
              className="options-dropdown"
              options={dropdownOptions}
            />
          )}
        </div>
        {description && <p className="description">{description}</p>}
        {content && <div className="content">{content}</div>}
      </div>
    </div>
  );
}
