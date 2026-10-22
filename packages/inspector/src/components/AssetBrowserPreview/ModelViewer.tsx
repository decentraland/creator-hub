import { useEffect, useRef, useState } from 'react';
import { MdPause, MdPlayArrow, MdAutorenew, MdGridOn } from 'react-icons/md';
import { Engine } from '@babylonjs/core/Engines/engine';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/loaders/glTF';

import { isEmoteContainer } from '../AssetPreview/emote';
import { loadModelContainer } from './gltfResolver';
import { createPreviewScene, frameCamera, isColliderMesh } from './modelScene';
import { EmoteViewer } from './EmoteViewer';
import type { PreviewSource } from './useAssetPreviewSource';

export type ModelStats = {
  triangles: number;
  meshes: number;
  materials: number;
  textures: number;
  animations: number;
};

type Props = {
  source: PreviewSource;
  onStats: (stats: ModelStats | undefined) => void;
  /** The file turned out to be an avatar animation, now playing on the avatar. */
  onEmote: () => void;
  onDuration?: (seconds: number) => void;
  onFailed: () => void;
};

function computeStats(container: AssetContainer): ModelStats {
  const visible = container.meshes.filter(mesh => !isColliderMesh(mesh));
  const triangles = visible.reduce((sum, mesh) => sum + mesh.getTotalIndices() / 3, 0);
  return {
    triangles: Math.round(triangles),
    meshes: visible.filter(mesh => mesh.getTotalVertices() > 0).length,
    materials: container.materials.length,
    textures: container.textures.length,
    animations: container.animationGroups.length,
  };
}

async function loadBytes(source: PreviewSource): Promise<Blob> {
  if (source.file) return source.file;
  const response = await fetch(source.url!);
  if (!response.ok) throw new Error(`Could not fetch ${source.name} (${response.status})`);
  return response.blob();
}

export function ModelViewer({ source, onStats, onEmote, onDuration, onFailed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene>();
  const cameraRef = useRef<ArcRotateCamera>();
  const containerRef = useRef<AssetContainer>();
  const [clips, setClips] = useState<AnimationGroup[]>([]);
  const [activeClip, setActiveClip] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [loading, setLoading] = useState(true);
  const [emoteFile, setEmoteFile] = useState<File | undefined>();
  const [wireframe, setWireframe] = useState(false);
  const wireframeRef = useRef(false);

  // One engine for the lifetime of the viewer; models are swapped in and out of its scene.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });
    const { scene, camera } = createPreviewScene(engine);
    camera.attachControl(canvas, true);
    camera.useAutoRotationBehavior = true;

    sceneRef.current = scene;
    cameraRef.current = camera;
    engine.runRenderLoop(() => scene.render());
    const observer = new ResizeObserver(() => engine.resize());
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
      sceneRef.current = undefined;
      cameraRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera || !source.url) return;

    let cancelled = false;
    setLoading(true);
    setEmoteFile(undefined);
    setClips([]);
    onStats(undefined);

    containerRef.current?.dispose();
    containerRef.current = undefined;

    let bytes: Blob | undefined;
    loadBytes(source)
      .then(loaded => {
        bytes = loaded;
        return loadModelContainer(scene, loaded, source.extension, source.resolveDependency);
      })
      .then(container => {
        if (cancelled) {
          container.dispose();
          return;
        }
        if (isEmoteContainer(container)) {
          container.dispose();
          // The avatar viewer takes a file; catalog emotes arrive as plain bytes.
          setEmoteFile(source.file ?? new File([bytes!], `${source.name}.${source.extension}`));
          setLoading(false);
          onEmote();
          return;
        }
        container.meshes.filter(isColliderMesh).forEach(mesh => (mesh.isVisible = false));
        container.addAllToScene();
        container.animationGroups.forEach(group => group.stop());
        containerRef.current = container;
        container.materials.forEach(material => (material.wireframe = wireframeRef.current));
        frameCamera(scene, camera);
        setClips(container.animationGroups);
        setActiveClip(0);
        setPlaying(container.animationGroups.length > 0);
        container.animationGroups[0]?.start(true);
        onStats(computeStats(container));
        setLoading(false);
      })
      .catch(error => {
        if (cancelled) return;
        console.error('Could not render model preview:', error);
        onFailed();
      });

    return () => {
      cancelled = true;
    };
  }, [source.url, source.extension]);

  useEffect(() => {
    if (cameraRef.current) cameraRef.current.useAutoRotationBehavior = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    wireframeRef.current = wireframe;
    containerRef.current?.materials.forEach(material => (material.wireframe = wireframe));
  }, [wireframe]);

  const selectClip = (index: number) => {
    clips.forEach(clip => clip.stop());
    setActiveClip(index);
    clips[index]?.start(true);
    setPlaying(true);
  };

  const togglePlay = () => {
    const clip = clips[activeClip];
    if (!clip) return;
    if (playing) clip.pause();
    else clip.play(true);
    setPlaying(!playing);
  };

  if (emoteFile) {
    return (
      <EmoteViewer
        file={emoteFile}
        onDuration={onDuration}
      />
    );
  }

  return (
    <div className="ModelViewer">
      <canvas
        ref={canvasRef}
        className="ModelViewer-canvas"
      />
      {loading && <div className="PreviewPane-spinner" />}
      <div className="ModelViewer-toolbar">
        <button
          className={autoRotate ? 'active' : ''}
          onClick={() => setAutoRotate(value => !value)}
          title="Auto-rotate"
          aria-label="Toggle auto-rotate"
        >
          <MdAutorenew />
        </button>
        <button
          className={wireframe ? 'active' : ''}
          onClick={() => setWireframe(value => !value)}
          title="Wireframe"
          aria-label="Toggle wireframe"
          aria-pressed={wireframe}
        >
          <MdGridOn />
        </button>
        {clips.length > 0 && (
          <>
            <button
              onClick={togglePlay}
              title={playing ? 'Pause animation' : 'Play animation'}
              aria-label={playing ? 'Pause animation' : 'Play animation'}
            >
              {playing ? <MdPause /> : <MdPlayArrow />}
            </button>
            <select
              value={activeClip}
              onChange={event => selectClip(Number(event.target.value))}
              aria-label="Animation clip"
            >
              {clips.map((clip, index) => (
                <option
                  key={clip.name + index}
                  value={index}
                >
                  {clip.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );
}
