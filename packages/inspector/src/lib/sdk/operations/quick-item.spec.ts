import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '@dcl/ecs';
import {
  AudioSource as defineAudioSource,
  Material as defineMaterial,
  Name as defineName,
  Transform as defineTransform,
  VideoPlayer as defineVideoPlayer,
} from '@dcl/ecs/dist/components';

import { createEditorComponents } from '../components';
import {
  isQuickItemKind,
  isTemplateMedia,
  setQuickItemSource as createSetQuickItemSource,
} from './quick-item';

describe('setQuickItemSource', () => {
  const engine = Engine();
  const { VideoScreen, Nodes } = createEditorComponents(engine);
  const Name = defineName(engine);
  const Material = defineMaterial(engine);
  const AudioSource = defineAudioSource(engine);
  const VideoPlayer = defineVideoPlayer(engine);
  defineTransform(engine);
  const setQuickItemSource = createSetQuickItemSource(engine);

  beforeEach(() => {
    Nodes.createOrReplace(engine.RootEntity, {
      value: [{ entity: engine.RootEntity, children: [] }],
    });
  });

  describe('when pointing an Image template at a dropped picture', () => {
    const entity = engine.addEntity();

    beforeEach(() => {
      Name.createOrReplace(entity, { value: 'Image' });
      Material.createOrReplace(entity, {
        material: {
          $case: 'pbr',
          pbr: {
            texture: { tex: { $case: 'texture', texture: { src: 'assets/image-logo.png' } } },
          },
        },
      });
      setQuickItemSource(entity, 'image', 'assets/photo.png', 'photo');
    });

    it('should swap the albedo texture for the dropped file', () => {
      const material = Material.get(entity).material;
      const tex = material?.$case === 'pbr' ? material.pbr.texture?.tex : undefined;
      expect(tex?.$case === 'texture' && tex.texture.src).toBe('assets/photo.png');
    });

    it('should name the entity after the file', () => {
      expect(Name.get(entity).value).toBe('photo');
    });
  });

  describe('when pointing an ambient sound template at a dropped clip', () => {
    const entity = engine.addEntity();

    beforeEach(() => {
      Name.createOrReplace(entity, { value: 'Ambient_Birds' });
      AudioSource.createOrReplace(entity, { audioClipUrl: 'assets/birds.mp3', loop: true });
      setQuickItemSource(entity, 'audio', 'assets/rain.mp3', 'rain');
    });

    it('should play the dropped clip and keep the other settings', () => {
      expect(AudioSource.get(entity)).toMatchObject({
        audioClipUrl: 'assets/rain.mp3',
        loop: true,
      });
    });
  });

  describe('when pointing a Video Screen template at a dropped video', () => {
    const entity = engine.addEntity();

    beforeEach(() => {
      Name.createOrReplace(entity, { value: 'Video Screen' });
      VideoPlayer.createOrReplace(entity, { src: 'https://stream.example/live.m3u8' });
      VideoScreen.createOrReplace(entity, {
        defaultURL: 'https://stream.example/live.m3u8',
      } as any);
      setQuickItemSource(entity, 'video', 'assets/trailer.mp4', 'trailer');
    });

    it('should point the player at the dropped file', () => {
      expect(VideoPlayer.get(entity).src).toBe('assets/trailer.mp4');
    });

    it('should point the screen default at the dropped file, so the admin bus does not restore the stream', () => {
      expect(VideoScreen.get(entity).defaultURL).toBe('assets/trailer.mp4');
    });
  });

  describe('when an entity with the file name already exists', () => {
    const existing = engine.addEntity();
    const entity = engine.addEntity();

    beforeEach(() => {
      Name.createOrReplace(existing, { value: 'photo' });
      Nodes.createOrReplace(engine.RootEntity, {
        value: [
          { entity: engine.RootEntity, children: [existing] },
          { entity: existing, children: [] },
        ],
      });
      Name.createOrReplace(entity, { value: 'Image' });
      setQuickItemSource(entity, 'image', 'assets/photo.png', 'photo');
    });

    it('should pick a unique name', () => {
      expect(Name.get(entity).value).toBe('photo_2');
    });
  });
});

describe('isQuickItemKind', () => {
  it('should accept the three media kinds and nothing else', () => {
    expect(isQuickItemKind('image')).toBe(true);
    expect(isQuickItemKind('audio')).toBe(true);
    expect(isQuickItemKind('video')).toBe(true);
    expect(isQuickItemKind('gltf')).toBe(false);
    expect(isQuickItemKind('script')).toBe(false);
    expect(isQuickItemKind('unknown')).toBe(false);
  });
});

describe('isTemplateMedia', () => {
  it("should flag the template's own clip but not its placeholder model", () => {
    expect(isTemplateMedia('audio', 'birds_(1).mp3')).toBe(true);
    expect(isTemplateMedia('audio', 'ambient_sound.glb')).toBe(false);
  });

  it('should leave the video screen model alone', () => {
    expect(isTemplateMedia('video', 'video_player.glb')).toBe(false);
    expect(isTemplateMedia('video', 'Intro.MP4')).toBe(true);
  });
});
