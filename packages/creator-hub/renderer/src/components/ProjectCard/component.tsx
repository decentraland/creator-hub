import { type MouseEvent, useCallback } from 'react';
import {
  CircularProgress as Loader,
  Typography,
  Badge,
  IconButton,
  Tooltip,
} from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';
import { isTimeAgo, minutes } from '/shared/time';

import { Dropdown } from '../Dropdown';

import type { Props } from './types';

import './styles.css';

export function ProjectCard({
  title,
  description,
  imageUrl,
  videoUrl,
  content,
  dropdownOptions,
  dropdownIcon,
  dropdownIconTitle,
  dropdownIconClick,
  width = 256,
  height = 240,
  autoHeight = false,
  publishedAt = 0,
  onClick,
  status,
}: Props) {
  const handleCardMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = e.currentTarget.querySelector<HTMLVideoElement>('video');
    if (video) {
      video.muted = true;
      video.play();
    }
  }, []);

  const handleCardMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = e.currentTarget.querySelector<HTMLVideoElement>('video');
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  }, []);

  const widthPx = `${width}px`;
  const heightPx = `${height}px`;

  return (
    <div
      className={`ProjectCard${autoHeight ? ' autoHeight' : ''}`}
      onClick={onClick}
      onMouseEnter={handleCardMouseEnter}
      onMouseLeave={handleCardMouseLeave}
      style={{
        width: widthPx,
        ...(autoHeight ? {} : { height: heightPx }),
      }}
    >
      <Overlay
        status={status}
        width={widthPx}
        height={heightPx}
      />
      {videoUrl ? (
        <video
          className="video"
          src={videoUrl}
        />
      ) : (
        <div
          className="thumbnail"
          style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : {}}
        />
      )}
      {isTimeAgo(publishedAt, minutes(10)) && (
        <Badge className="badge">{t('scene_list.badges.published')}</Badge>
      )}
      <div className="info">
        <div className="title">
          <Typography variant="h6">{title}</Typography>
          {dropdownIcon && dropdownIconClick && dropdownIconTitle ? (
            <span className="title-actions">
              <Tooltip
                title={dropdownIconTitle}
                placement="top"
              >
                <IconButton
                  className="options-dropdown"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    dropdownIconClick();
                  }}
                  size="small"
                >
                  {dropdownIcon}
                </IconButton>
              </Tooltip>
              {dropdownOptions?.length ? (
                <Dropdown
                  className="options-dropdown"
                  options={dropdownOptions}
                />
              ) : null}
            </span>
          ) : dropdownOptions?.length ? (
            <Dropdown
              className="options-dropdown"
              options={dropdownOptions}
              icon={dropdownIcon}
            />
          ) : null}
        </div>
        {description && <p className="description">{description}</p>}
        {content && <div className="content">{content}</div>}
      </div>
    </div>
  );
}

function Overlay({
  status,
  width,
  height,
}: {
  status: Props['status'];
  width: string;
  height: string;
}) {
  if (status !== 'loading') return null;

  const handleClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return (
    <div
      className="Overlay"
      style={{ width, height }}
      onClick={handleClick}
    >
      <Loader />
      {t('scene_list.saving')}
    </div>
  );
}
