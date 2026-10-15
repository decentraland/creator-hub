import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  PBMaterial,
} from '@dcl/ecs';
import {
  AudioSource as AudioSourceEngine,
  Name as NameEngine,
  VideoPlayer as VideoPlayerEngine,
} from '@dcl/ecs';
import { ComponentName } from '@dcl/asset-packs';

import type { IAsset } from '../../../components/ProjectAssetExplorer/types';
import type { EditorComponents } from '../components';
import { CoreComponents } from '../components';
import { generateUniqueName } from './add-child';

export type QuickItemKind = 'image' | 'audio' | 'video';

// A media file dropped on the viewport spawns one of these catalog items and then
// `setQuickItemSource` points it at the dropped file (#231). Reusing the catalog
// item gives the entity the components and basic-view Config a hand-placed one has.
export const QUICK_ITEM_TEMPLATES: Record<QuickItemKind, { assetId: string; name: string }> = {
  image: { assetId: '37460a1e-affc-4f87-b725-118cc11d86fc', name: 'Image' },
  audio: { assetId: '5c8b4646-6ec0-41a0-8e9b-415a58728a9e', name: 'Ambient Sound - Forest Birds' },
  video: { assetId: '0201653b-bd38-48af-b9ef-a902a7e8bc9c', name: 'Video Screen' },
};

const MEDIA_EXTENSIONS: Record<QuickItemKind, string[]> = {
  image: ['.png', '.jpg', '.jpeg'],
  audio: ['.mp3', '.ogg', '.wav'],
  video: ['.mp4'],
};

export function isQuickItemKind(type: IAsset['type']): type is QuickItemKind {
  return type === 'image' || type === 'audio' || type === 'video';
}

// The template's own media file is dead weight once the dropped file replaces it.
export function isTemplateMedia(kind: QuickItemKind, path: string): boolean {
  const lower = path.toLowerCase();
  return MEDIA_EXTENSIONS[kind].some(ext => lower.endsWith(ext));
}

export function setQuickItemSource(engine: IEngine) {
  return function setQuickItemSource(
    entity: Entity,
    kind: QuickItemKind,
    src: string,
    name: string,
  ) {
    switch (kind) {
      case 'image': {
        // `Material` from @dcl/ecs is the extended helper object, which carries no
        // componentName, so it is looked up by its core name.
        const Material = engine.getComponent(
          CoreComponents.MATERIAL,
        ) as LastWriteWinElementSetComponentDefinition<PBMaterial>;
        const material = Material.getMutableOrNull(entity)?.material;
        const tex = material?.$case === 'pbr' ? material.pbr.texture?.tex : undefined;
        if (tex?.$case === 'texture') tex.texture.src = src;
        break;
      }
      case 'audio': {
        const AudioSource = engine.getComponent(
          AudioSourceEngine.componentName,
        ) as typeof AudioSourceEngine;
        const audio = AudioSource.getMutableOrNull(entity);
        if (audio) audio.audioClipUrl = src;
        break;
      }
      case 'video': {
        const VideoPlayer = engine.getComponent(
          VideoPlayerEngine.componentName,
        ) as typeof VideoPlayerEngine;
        const video = VideoPlayer.getMutableOrNull(entity);
        if (video) video.src = src;
        // The admin message bus re-seeds VideoPlayer.src from VideoScreen.defaultURL at
        // runtime, so the template's stream URL would win back unless it changes too.
        const VideoScreen = engine.getComponentOrNull(ComponentName.VIDEO_SCREEN) as
          | EditorComponents['VideoScreen']
          | null;
        const screen = VideoScreen?.getMutableOrNull(entity);
        if (screen) screen.defaultURL = src;
        break;
      }
    }

    const Name = engine.getComponent(NameEngine.componentName) as typeof NameEngine;
    const current = Name.getMutableOrNull(entity);
    if (current) current.value = generateUniqueName(engine, Name, name);
  };
}

export default setQuickItemSource;
