import React, { useEffect, useState } from 'react';
import { IoIosImage } from 'react-icons/io';
import { IoCubeOutline, IoVideocamOutline } from 'react-icons/io5';
import { AiOutlineSound } from 'react-icons/ai';
import { FaFile } from 'react-icons/fa';
import { SiTypescript } from 'react-icons/si';
import { BsFillLightningChargeFill } from 'react-icons/bs';
import { MdKeyboardArrowDown, MdKeyboardArrowUp, MdOutlineEmojiPeople } from 'react-icons/md';
import cx from 'classnames';

import { isSmart, type CustomAsset } from '../../lib/logic/catalog';
import { ErrorBoundary } from '../ErrorBoundary';
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
      return <IoIosImage />;
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
  const [failedUrl, setFailedUrl] = useState<string>();
  const toggleSize = () => setActualSize(value => !value);
  if (failedUrl !== undefined && failedUrl === source.url) {
    return (
      <ViewerUnavailable
        kind="image"
        reason="The browser could not decode this image"
      />
    );
  }
  return (
    <div className={`ImageViewer ${actualSize ? 'actual' : ''}`}>
      <img
        src={source.url}
        alt={source.name}
        onError={() => setFailedUrl(source.url)}
        role="button"
        tabIndex={0}
        aria-pressed={actualSize}
        onClick={toggleSize}
        onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          toggleSize();
        }}
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

/** Shown when a file has no preview the editor can draw: the reason, when known, goes under it. */
function ViewerUnavailable({ kind, reason }: { kind: PreviewKind; reason?: string }) {
  return (
    <div className="PreviewPane-placeholder">
      <KindIcon kind={kind} />
      <span>Preview unavailable</span>
      {reason && <span className="PreviewPane-reason">{reason}</span>}
    </div>
  );
}

/**
 * Audio and video play through the browser's own decoders, which reject codecs and containers
 * they do not ship (an unsupported .wav encoding, a non-H.264 .mp4). The media element reports
 * that as an `error` event, not an exception, so without this the pane would show a dead player.
 */
function MediaViewer({
  source,
  kind,
  onDuration,
}: {
  source: PreviewSource;
  kind: 'audio' | 'video';
  onDuration: (seconds: number) => void;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  if (failedUrl !== undefined && failedUrl === source.url) {
    return (
      <ViewerUnavailable
        kind={kind}
        reason="The browser cannot play this file"
      />
    );
  }
  if (kind === 'video') {
    return (
      <video
        className="VideoViewer"
        controls
        src={source.url}
        onLoadedMetadata={event => onDuration(event.currentTarget.duration)}
        onError={() => setFailedUrl(source.url)}
      />
    );
  }
  return (
    <div className="PreviewPane-placeholder">
      <KindIcon kind="audio" />
      <audio
        controls
        src={source.url}
        onLoadedMetadata={event => onDuration(event.currentTarget.duration)}
        onError={() => setFailedUrl(source.url)}
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
  // Keyed by URL rather than reset in an effect: a viewer that fails while mounting reports
  // before this component's own effects run, and a reset there would wipe that report.
  const [failedUrl, setFailedUrl] = useState<string>();
  const failed = failedUrl !== undefined && failedUrl === source.url;
  const previewEmote = getBuiltInPreviewEmote(source.builtInEmote);

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
        onFailed={() => setFailedUrl(source.url)}
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
      <ViewerUnavailable kind={source.kind} />
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
        <ViewerUnavailable kind="emote" />
      );
    case 'audio':
    case 'video':
      return (
        <MediaViewer
          source={source}
          kind={source.kind}
          onDuration={duration => onDetails({ duration })}
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

/** A labelled field whose value needs its own lines (prose, a list of chips). */
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="PreviewPane-block">
      <span>{label}</span>
      {children}
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
  // Catalog items write a one-line `caption` far more often than a `description`.
  const description = assetData?.description || assetData?.caption;
  const tags = assetData?.tags ?? [];
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
          <ErrorBoundary
            name="asset-viewer"
            resetKeys={[selection.source, selection.id]}
            fallback={<ViewerUnavailable kind={source.kind} />}
          >
            <Viewer
              key={`${selection.source}:${selection.id}`}
              source={source}
              onDetails={patch => setDetails(current => ({ ...current, ...patch }))}
            />
          </ErrorBoundary>
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
        {description && (
          <Block label="Description">
            <p>{description}</p>
          </Block>
        )}
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
        {tags.length > 0 && (
          <Block label="Tags">
            <div className="PreviewPane-tags">
              {tags.map(tag => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </Block>
        )}
      </div>
    </aside>
  );
}

/**
 * The viewer has its own boundary so a file the browser rejects still shows its name and size;
 * this outer one covers the details themselves (a custom item with a malformed composite, say).
 * Either way a bad file costs its preview, never the inspector.
 */
function GuardedPreviewPane() {
  const { selection } = useAssetSelection();
  return (
    <ErrorBoundary
      name="preview-pane"
      resetKeys={[selection?.source, selection?.id]}
      fallback={
        <aside className="PreviewPane PreviewPane-empty">
          <FaFile />
          <p>Preview unavailable</p>
        </aside>
      }
    >
      <PreviewPane />
    </ErrorBoundary>
  );
}

export default React.memo(GuardedPreviewPane);
