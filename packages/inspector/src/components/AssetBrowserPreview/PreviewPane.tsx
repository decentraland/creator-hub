import React, { useEffect, useState } from 'react';
import { IoCubeOutline, IoImageOutline, IoVideocamOutline } from 'react-icons/io5';
import { AiOutlineSound } from 'react-icons/ai';
import { FaFile } from 'react-icons/fa';
import { SiTypescript } from 'react-icons/si';
import { BsFillLightningChargeFill } from 'react-icons/bs';

import { isSmart } from '../../lib/logic/catalog';
import { ModelViewer, type ModelStats } from './ModelViewer';
import { useAssetSelection } from './selection';
import {
  formatBytes,
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
    default:
      return <FaFile />;
  }
}

function ImageViewer({
  source,
  onDimensions,
}: {
  source: PreviewSource;
  onDimensions: (value: string) => void;
}) {
  const [actualSize, setActualSize] = useState(false);
  return (
    <div className={`ImageViewer ${actualSize ? 'actual' : ''}`}>
      <img
        src={source.url}
        alt={source.name}
        onClick={() => setActualSize(value => !value)}
        onLoad={event =>
          onDimensions(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`)
        }
        title={actualSize ? 'Click to fit' : 'Click for actual size'}
      />
    </div>
  );
}

function Viewer({
  source,
  onStats,
  onDimensions,
}: {
  source: PreviewSource;
  onStats: (stats: ModelStats | undefined) => void;
  onDimensions: (value: string) => void;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [source.url]);

  if (source.kind === 'model' && !failed) {
    return (
      <ModelViewer
        source={source}
        onStats={onStats}
        onFailed={() => setFailed(true)}
      />
    );
  }
  if (source.kind === 'model' || (source.kind === 'image' && !source.url)) {
    return source.thumbnail ? (
      <ImageViewer
        source={{ ...source, url: source.thumbnail }}
        onDimensions={onDimensions}
      />
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
          onDimensions={onDimensions}
        />
      );
    case 'audio':
      return (
        <div className="PreviewPane-placeholder">
          <KindIcon kind="audio" />
          <audio
            controls
            src={source.url}
          />
        </div>
      );
    case 'video':
      return (
        <video
          className="VideoViewer"
          controls
          src={source.url}
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

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === '') return null;
  return (
    <div className="PreviewPane-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PreviewPane() {
  const { selection } = useAssetSelection();
  const state = useAssetPreviewSource(selection);
  const [stats, setStats] = useState<ModelStats | undefined>();
  const [dimensions, setDimensions] = useState<string | undefined>();

  useEffect(() => {
    setStats(undefined);
    setDimensions(undefined);
  }, [selection]);

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
  const source = state.status === 'ready' ? state.source : undefined;

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
            onStats={setStats}
            onDimensions={setDimensions}
          />
        )}
      </div>
      <div className="PreviewPane-info">
        <h3 title={selection.name}>
          {source && <KindIcon kind={source.kind} />}
          <span>{selection.name}</span>
          {catalogAsset && isSmart(catalogAsset) && (
            <BsFillLightningChargeFill
              className="PreviewPane-smart"
              title="Smart item"
            />
          )}
        </h3>
        {catalogAsset?.description && <p>{catalogAsset.description}</p>}
        <Row
          label="Type"
          value={source ? KIND_LABEL[source.kind] : undefined}
        />
        <Row
          label="Source"
          value={
            selection.source === 'local'
              ? 'Scene'
              : selection.source === 'custom'
                ? 'My items'
                : 'Asset pack'
          }
        />
        <Row
          label="Category"
          value={catalogAsset?.category}
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
        {catalogAsset && catalogAsset.tags.length > 0 && (
          <div className="PreviewPane-tags">
            {catalogAsset.tags.slice(0, 8).map(tag => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

export default React.memo(PreviewPane);
