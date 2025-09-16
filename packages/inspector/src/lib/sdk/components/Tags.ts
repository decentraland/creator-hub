import { type Entity, type IEngine, Schemas } from '@dcl/ecs';
import { EditorComponentNames } from './types';
import type { EditorComponents } from '.';

enum TagType {
  Engine = 1,
  Custom = 2,
}

export type Tag = {
  name: string;
  type: TagType;
};

const Tag = Schemas.Map({
  name: Schemas.String,
  type: Schemas.EnumNumber(TagType, TagType.Custom),
});

const DEFAULT_TAGS = [
  { name: 'Tag Group 1', type: TagType.Engine },
  { name: 'Tag Group 2', type: TagType.Engine },
  { name: 'Tag Group 3', type: TagType.Engine },
  { name: 'Tag Group 4', type: TagType.Engine },
];

export function defineTagsComponents(engine: IEngine) {
  const Tags = engine.defineComponent(EditorComponentNames.Tags, { tags: Schemas.Array(Tag) });
  Tags.createOrReplace(engine.RootEntity, { tags: DEFAULT_TAGS });
  engine.update(1);
  return Tags;
}

export function getSceneTags(engine: IEngine) {
  return getTagsForEntity(engine, engine.RootEntity);
}

export function getTagsForEntity(engine: IEngine, entity: Entity) {
  const tagsComponent = engine.getComponentOrNull(EditorComponentNames.Tags);
  try {
    return tagsComponent ? (tagsComponent.get(entity) as { tags: Tag[] }).tags : [];
  } catch (error) {
    return [];
  }
}

export function updateTagsForEntity(engine: IEngine, entity: Entity, tagName: string) {
  const Tags = engine.getComponentOrNull(EditorComponentNames.Tags) as EditorComponents['Tags'];
  const sceneTags = getSceneTags(engine);
  const entityTags = getTagsForEntity(engine, entity);
  if (Tags) {
    const isTagCreated = sceneTags.some(tag => tag.name === tagName);
    if (isTagCreated) {
      Tags.createOrReplace(entity, {
        tags: [...entityTags, { name: tagName, type: TagType.Custom }],
      });
      engine.update(1);
    } else {
      throw new Error('Tag is not created yet');
    }
  }
}

// const tags = Tags.get(engine.RootEntity).tags;

// function addNewTag(value: string) {
//   const currentTags = Tags.getOrNull(engine.RootEntity)?.tags ?? [];
//   Tags.getMutable(engine.RootEntity).tags = [...currentTags, value];
// }

// // entity: Floor
// Tags.create(entityFloor, { tags: ['', ''] });

// Tags.create(engine.addEntity());

// Tag.create(engine.addEntity(), { name: 'Tag 1' });

// function getEntitiesByTagUser(value: string) {
//   const tags = Tags.get(engine.RootEntity).tags;
//   const newTags = tags.filter($ => $.name === '' && $.type === TagType.Custom);

//   Tags.getMutable(engine.RootEntity).tags = newTags;
// }
