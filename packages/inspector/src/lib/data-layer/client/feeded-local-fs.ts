import { Composite } from '@dcl/ecs';
import type { Scene } from '@dcl/schemas';
import { PointerEvents } from '@dcl/ecs/dist/components';
import { defineMaterialComponent } from '@dcl/ecs/dist/components/extended/Material';

import { toSceneComponent } from '../host/utils/component';
import { dumpEngineToComposite } from '../host/utils/engine-to-composite';
import { createFileSystemInterface } from '../../logic/file-system-interface';
import { createEngineContext } from '../host/utils/engine';
import { createInMemoryStorage } from '../../logic/storage/in-memory';
import { SceneAgeRating } from '../../sdk/components';
import { TransitionMode } from '../../sdk/components/SceneMetadata';
import { getScriptTemplateClass } from '../../../components/EntityInspector/ScriptInspector/templates';
import { downloadAssets } from './builder-utils';
import { SCENE_INFO_MARKDOWN, THUMBNAIL } from './constants';

export function createTempEngineContext() {
  const { engine, components } = createEngineContext();
  return {
    engine,
    components: {
      ...components,
      Material: defineMaterialComponent(engine),
      PointerEvents: PointerEvents(engine),
    },
  };
}

type TempEngine = ReturnType<typeof createTempEngineContext>;

export function generateMinimalComposite({ engine, components }: TempEngine) {
  // nodes
  components.Nodes.create(engine.RootEntity, {
    value: [
      { entity: engine.RootEntity, children: [], open: true },
      { entity: engine.PlayerEntity, children: [] },
      { entity: engine.CameraEntity, children: [] },
    ],
  });

  // scene
  components.Scene.create(engine.RootEntity, {
    name: 'Test Scene',
    description: 'This is a test scene',
    thumbnail: 'assets/scene/thumbnail.png',
    ageRating: SceneAgeRating.Teen,
    skyboxConfig: {
      fixedTime: 36000,
      transitionMode: TransitionMode.TM_FORWARD,
    },
    categories: [],
    author: '',
    email: '',
    tags: [],
    layout: {
      base: {
        x: 0,
        y: 0,
      },
      parcels: [
        {
          x: 0,
          y: 0,
        },
      ],
    },
  });

  const composite = dumpEngineToComposite(engine, 'json');
  return Composite.toJson(composite);
}

export function generateFeededComposite({ engine, components }: TempEngine, scene: Scene) {
  // custom component
  const cubeIdComponent = engine.defineComponent('cube-id', {});

  // entities
  const entity = engine.addEntity();
  const gltfEntity = engine.addEntity();
  const scriptEntity = engine.addEntity();

  components.InspectorUIState.create(engine.RootEntity, { sceneInfoPanelVisible: false });
  components.Transform.create(entity, { position: { x: 8, y: 1, z: 8 } });
  components.MeshRenderer.setBox(entity);
  cubeIdComponent.create(entity);
  components.PointerEvents.create(entity, {
    pointerEvents: [
      {
        eventType: 1,
        eventInfo: {
          button: 1,
          hoverText: 'Press E to spawn',
          maxDistance: 100,
          showFeedback: true,
        },
      },
    ],
  });
  components.Material.setPbrMaterial(entity, {
    albedoColor: {
      r: 1,
      g: 1,
      b: 1,
      a: 1,
    },
  });
  components.Name.create(entity, { value: 'Magic Cube' });

  components.Transform.create(gltfEntity, {
    position: {
      x: 4,
      y: 0.8,
      z: 8,
    },
  });
  components.GltfContainer.create(gltfEntity, { src: 'assets/scene/Models/example/model.glb' });
  cubeIdComponent.create(gltfEntity);
  components.Name.create(gltfEntity, { value: 'Gltf Test' });
  components.Name.create(scriptEntity, { value: 'Script Test' });

  // nodes
  components.Nodes.create(engine.RootEntity, {
    value: [
      { entity: engine.RootEntity, children: [entity, gltfEntity, scriptEntity], open: true },
      { entity: engine.PlayerEntity, children: [] },
      { entity: engine.CameraEntity, children: [] },
      { entity, children: [] },
      { entity: gltfEntity, children: [] },
      { entity: scriptEntity, children: [] },
    ],
  });

  // script
  components.Transform.create(scriptEntity, { position: { x: 0, y: 1, z: 2 } });
  components.Script.create(scriptEntity, {
    value: [
      {
        path: 'assets/scene/Scripts/feeded-script.ts',
        priority: 0,
        layout: JSON.stringify({
          params: {
            message: {
              type: 'string',
              value: "That's what she said...",
            },
          },
        }),
      },
    ],
  });

  // scene
  components.Scene.create(engine.RootEntity, toSceneComponent(scene));

  const composite = dumpEngineToComposite(engine, 'json');
  return Composite.toJson(composite);
}

export const getMinimalComposite = () => generateMinimalComposite(createTempEngineContext());

const builderMappings: Record<string, string> = {
  'assets/scene/Models/example/model.glb':
    'bafkreibzw3d2aziiw2yhq7eoihytxthsulbihbr2ds2zegmsreaycy4h7e',
};

function getFeededEngineAndComposite(scene: Scene) {
  const context = createTempEngineContext();
  return { engineContext: context, composite: generateFeededComposite(context, scene) };
}

export async function feededFileSystem(mappings: Record<string, string> = builderMappings) {
  const scene: Scene = {
    main: '',
    display: {
      title: 'Feeded Scene',
      description: 'This is a feeded scene.json into memory',
      navmapThumbnail: 'assets/scene/feeded-thumbnail.png',
    },
    scene: {
      parcels: ['2,2', '2,3', '3,2', '3,3'],
      base: '2,2',
    },
    contact: {
      name: 'John Doe',
      email: 'johndoe@email.com',
    },
    tags: ['game', 'art', 'super fun', 'cool'],
    spawnPoints: [
      {
        name: 'Feeded Spawn Point',
        default: true,
        position: {
          x: [4, 6],
          y: [1, 1],
          z: [4, 6],
        },
        cameraTarget: {
          x: 8,
          y: 1,
          z: 8,
        },
      },
    ],
    featureToggles: {
      voiceChat: 'disabled',
    },
  };

  const { composite } = getFeededEngineAndComposite(scene);

  const assets = await downloadAssets(mappings);
  const scriptTemplate = getScriptTemplateClass('FeededScript');

  const storage = createInMemoryStorage({
    ...assets,
    'assets/scene/main.composite': Buffer.from(JSON.stringify(composite), 'utf-8'),
    'thumbnails/scene/feeded-thumbnail.png': Buffer.from(THUMBNAIL, 'base64'),
    'assets/scene/feeded-thumbnail.png': Buffer.from(THUMBNAIL, 'base64'),
    'scene.json': Buffer.from(JSON.stringify(scene), 'utf-8'),
    'SCENE_README.md': Buffer.from(SCENE_INFO_MARKDOWN, 'utf-8'),
    'assets/scene/Scripts/feeded-script.ts': Buffer.from(scriptTemplate, 'utf-8'),
  });

  return createFileSystemInterface(storage);
}
