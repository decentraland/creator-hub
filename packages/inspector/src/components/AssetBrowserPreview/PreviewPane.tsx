import React, { useEffect, useState } from 'react';
import { IoCubeOutline, IoImageOutline, IoVideocamOutline } from 'react-icons/io5';
import { AiOutlineSound } from 'react-icons/ai';
import { FaFile } from 'react-icons/fa';
import { SiTypescript } from 'react-icons/si';
import { BsFillLightningChargeFill } from 'react-icons/bs';
import { MdKeyboardArrowDown, MdKeyboardArrowUp, MdOutlineEmojiPeople } from 'react-icons/md';
import cx from 'classnames';

import { isSmart, type CustomAsset } from '../../lib/logic/catalog';
import CustomAssetIcon from '../Icons/CustomAsset';
import { getBuiltInPreviewEmote } from './baseEmotes';
import { EmoteViewer } from './EmoteViewer';
import { ModelViewer, type ModelStats } from './ModelViewer';
import { useAssetSelection } from './selection';
import {
  formatBytes,
  formatDuration,
  useAssetPreviewSource,
  type PreviewKind,
  type PreviewSource,
} from './useAssetPreviewSource';

import './PreviewPane.css';

const KIND_LABEL: Record<PreviewKind, string> = {
  model: '3D model',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  script: 'Script',
  emote: 'Avatar animation',
  custom: 'Custom item',
  other: 'File',
};

function KindIcon({ kind }: { kind: PreviewKind }) {
  switch (kind) {
    case 'model':
      return <IoCubeOutline />;
    case 'image':
      return <IoImageOutline />;
    case 'audio':
      return <AiOutlineSound />;
    case 'video':
      return <IoVideocamOutline />;
    case 'script':
      return <SiTypescript />;
    case 'emote':
      return <MdOutlineEmojiPeople />;
    case 'custom':
      return <CustomAssetIcon />;
    default:
      return <FaFile />;
  }
}

function ImageViewer({
  source,
  onDimensions,
}: {
  source: PreviewSource;
  /** Only the image itself reports its size; a stand-in thumbnail says nothing about the asset. */
  onDimensions?: (value: string) => void;
}) {
  const [actualSize, setActualSize] = useState(false);
  return (
    <div className={`ImageViewer ${actualSize ? 'actual' : ''}`}>
      <img
        src={source.url}
        alt={source.name}
        onClick={() => setActualSize(value => !value)}
        onLoad={event =>
          onDimensions?.(
            `${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`,
          )
        }
        title={actualSize ? 'Click to fit' : 'Click for actual size'}
      />
    </div>
  );
}

/** What the pane learns about the asset while its viewer runs. */
type Details = {
  stats?: ModelStats;
  dimensions?: string;
  duration?: number;
  /** A model file that turned out to be an avatar animation. */
  isEmote?: boolean;
};

function Viewer({
  source,
  onDetails,
}: {
  source: PreviewSource;
  onDetails: (patch: Details) => void;
}) {
  const [failed, setFailed] = useState(false);
  const previewEmote = getBuiltInPreviewEmote(source.builtInEmote);

  useEffect(() => setFailed(false), [source.url]);

  if (previewEmote) {
    return (
      <EmoteViewer
        previewEmote={previewEmote}
        onDuration={duration => onDetails({ duration })}
      />
    );
  }

  if (source.kind === 'model' && !failed) {
    return (
      <ModelViewer
        source={source}
        onStats={stats => onDetails({ stats })}
        onEmote={() => onDetails({ isEmote: true })}
        onDuration={duration => onDetails({ duration })}
        onFailed={() => setFailed(true)}
      />
    );
  }
  if (source.kind === 'model' || source.kind === 'custom') {
    return source.thumbnail ? (
      <>
        <ImageViewer source={{ ...source, url: source.thumbnail }} />
        <span className="PreviewPane-note">
          {source.kind === 'custom'
            ? 'Custom item · showing its thumbnail'
            : '3D preview unavailable, showing thumbnail'}
        </span>
      </>
    ) : (
      <div className="PreviewPane-placeholder">
        <KindIcon kind={source.kind} />
        <span>Preview unavailable</span>
      </div>
    );
  }
  switch (source.kind) {
    case 'image':
      return (
        <ImageViewer
          source={source}
          onDimensions={dimensions => onDetails({ dimensions })}
        />
      );
    case 'emote':
      if (source.file) {
        return (
          <EmoteViewer
            file={source.file}
            onDuration={duration => onDetails({ duration })}
          />
        );
      }
      // A built-in that is neither known to the avatar preview nor published as a base emote only
      // ships its animated thumbnail.
      return source.url ? (
        <>
          <ImageViewer source={source} />
          <span className="PreviewPane-note">Built-in animation · animated preview</span>
        </>
      ) : (
        <div className="PreviewPane-placeholder">
          <KindIcon kind="emote" />
          <span>Preview unavailable</span>
        </div>
      );
    case 'audio':
      return (
        <div className="PreviewPane-placeholder">
          <KindIcon kind="audio" />
          <audio
            controls
            src={source.url}
            onLoadedMetadata={event => onDetails({ duration: event.currentTarget.duration })}
          />
        </div>
      );
    case 'video':
      return (
        <video
          className="VideoViewer"
          controls
          src={source.url}
          onLoadedMetadata={event => onDetails({ duration: event.currentTarget.duration })}
        />
      );
    default:
      return (
        <div className="PreviewPane-placeholder">
          <KindIcon kind={source.kind} />
          <span>No preview for this file type</span>
        </div>
      );
  }
}

const INFO_OPEN_KEY = 'inspector:preview-info-open';

// The choice outlives the selection: flipping between assets keeps the panel as the user left it.
function readInfoOpen(): boolean {
  try {
    return localStorage.getItem(INFO_OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === '') return null;
  return (
    <div className="PreviewPane-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function countEntities(asset: CustomAsset): number {
  const ids = new Set<string>();
  asset.composite.components.forEach(component =>
    Object.keys(component.data).forEach(id => ids.add(id)),
  );
  return ids.size;
}

function PreviewPane() {
  const { selection } = useAssetSelection();
  const state = useAssetPreviewSource(selection);
  const [details, setDetails] = useState<Details>({});
  const [infoOpen, setInfoOpen] = useState(readInfoOpen);

  const toggleInfo = () => {
    setInfoOpen(open => {
      try {
        localStorage.setItem(INFO_OPEN_KEY, String(!open));
      } catch {
        // the choice just won't be remembered
      }
      return !open;
    });
  };

  useEffect(() => setDetails({}), [selection]);

  if (!selection) {
    return (
      <aside className="PreviewPane PreviewPane-empty">
        <IoCubeOutline />
        <p>Select an asset to preview it here</p>
        <small>Drag it into the scene to use it</small>
      </aside>
    );
  }

  const catalogAsset = selection.source === 'catalog' ? selection.asset : undefined;
  const customAsset = selection.source === 'custom' ? selection.asset : undefined;
  const assetData = catalogAsset ?? customAsset;
  const source = state.status === 'ready' ? state.source : undefined;
  const { stats, dimensions, duration, isEmote } = details;

  const typeLabel = !source
    ? undefined
    : source.builtInEmote
      ? 'Avatar animation (built-in)'
      : isEmote
        ? KIND_LABEL.emote
        : KIND_LABEL[source.kind];

  return (
    <aside className="PreviewPane">
      <div className="PreviewPane-viewer">
        {state.status === 'loading' && <div className="PreviewPane-spinner" />}
        {state.status === 'error' && (
          <div className="PreviewPane-placeholder">
            <FaFile />
            <span>Could not load this asset</span>
          </div>
        )}
        {source && (
          <Viewer
            key={`${selection.source}:${selection.id}`}
            source={source}
            onDetails={patch => setDetails(current => ({ ...current, ...patch }))}
          />
        )}
      </div>
      <div className={cx('PreviewPane-info', { collapsed: !infoOpen })}>
        <h3 title={selection.name}>
          {source && <KindIcon kind={isEmote ? 'emote' : source.kind} />}
          <span>{selection.name}</span>
          {catalogAsset && isSmart(catalogAsset) && (
            <BsFillLightningChargeFill
              className="PreviewPane-smart"
              title="Smart item"
            />
          )}
          <button
            className="PreviewPane-infoToggle"
            onClick={toggleInfo}
            title={infoOpen ? 'Hide details' : 'Show details'}
            aria-label={infoOpen ? 'Hide details' : 'Show details'}
            aria-expanded={infoOpen}
            data-test-id="preview-info-toggle"
          >
            {infoOpen ? <MdKeyboardArrowDown /> : <MdKeyboardArrowUp />}
          </button>
        </h3>
        {infoOpen && assetData?.description && <p>{assetData.description}</p>}
        <Row
          label="Type"
          value={typeLabel}
        />
        <Row
          label="Category"
          value={assetData?.category}
        />
        <Row
          label="Size"
          value={source?.size !== undefined ? formatBytes(source.size) : undefined}
        />
        <Row
          label="Dimensions"
          value={dimensions}
        />
        <Row
          label="Duration"
          value={duration !== undefined ? formatDuration(duration) : undefined}
        />
        {customAsset && (
          <>
            <Row
              label="Entities"
              value={countEntities(customAsset)}
            />
            <Row
              label="Files"
              value={customAsset.resources.length}
            />
          </>
        )}
        {!isEmote && (
          <>
            <Row
              label="Triangles"
              value={stats?.triangles.toLocaleString()}
            />
            <Row
              label="Meshes"
              value={stats?.meshes}
            />
            <Row
              label="Materials"
              value={stats?.materials}
            />
            <Row
              label="Textures"
              value={stats?.textures}
            />
            <Row
              label="Animations"
              value={stats && stats.animations > 0 ? stats.animations : undefined}
            />
          </>
        )}
        {assetData && assetData.tags.length > 0 && (
          <div className="PreviewPane-tags">
            {assetData.tags.slice(0, 8).map(tag => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

export default React.memo(PreviewPane);
