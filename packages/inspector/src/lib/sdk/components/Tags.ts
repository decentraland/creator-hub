import { type Entity, type IEngine, Schemas } from '@dcl/ecs';
import { EditorComponentNames } from './types';
import type { EditorComponents } from '.';

export enum TagType {
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

export const getTagComponent = (engine: IEngine) => {
  return engine.getComponentOrNull(EditorComponentNames.Tags) as EditorComponents['Tags'];
};

//TODO: create if not exists??
export function getSceneTags(engine: IEngine) {
  return getTagsForEntity(engine, engine.RootEntity);
}

//TODO I can use getMutable or null
export function getTagsForEntity(engine: IEngine, entity: Entity) {
  const tagsComponent = getTagComponent(engine);
  try {
    return tagsComponent ? (tagsComponent.get(entity) as { tags: Tag[] }).tags : [];
  } catch (error) {
    return [];
  }
}

//TODO: validation of duplicates??
export function updateTagsForEntity(engine: IEngine, entity: Entity, tags: Tag[]) {
  const Tags = getTagComponent(engine);
  if (Tags) {
    Tags.createOrReplace(entity, { tags });
    engine.update(1);
  }
}

//TODO: validate no repeat names :)
export function createTag(engine: IEngine, name: string) {
  const Tags = getTagComponent(engine);
  const currentTags = getSceneTags(engine);
  if (Tags) {
    Tags.getMutable(engine.RootEntity).tags = [...currentTags, { name, type: TagType.Custom }];
    engine.update(1);
  }
}

//TODO: validate that is not a engine tag
export function removeTag(engine: IEngine, name: string) {
  const Tags = getTagComponent(engine);
  const entitiesWithTags = engine.getEntitiesWith(Tags);

  for (const [entity] of entitiesWithTags) {
    const currentTags = Tags.getMutable(entity).tags;
    const newTags = currentTags.filter($ => $.name !== name);
    Tags.getMutable(entity).tags = newTags;
  }

  engine.update(1);
}

export const renameTag = (engine: IEngine, tag: string, newName: string) => {
  const Tags = getTagComponent(engine);
  const entitiesWithTags = engine.getEntitiesWith(Tags);

  for (const [entity] of entitiesWithTags) {
    const currentTags = Tags.getMutable(entity).tags;
    const newTags = currentTags.map($ => ($.name === tag ? { ...$, name: newName } : $));
    Tags.getMutable(entity).tags = newTags;
  }

  engine.update(1);
};

export const getEntitiesWithTag = (engine: IEngine, tagName: string) => {
  const Tags = getTagComponent(engine);
  return Array.from(engine.getEntitiesWith(Tags))
    .filter(
      ([entity, component]) =>
        entity !== engine.RootEntity && component.tags.some(tag => tag.name === tagName),
    )
    .map(([entity]) => entity);
};

// const tags = Tags.get(engine.RootEntity).tags;
// const newTags = tags.filter($ => $.name === '' && $.type === TagType.Custom);

// Tags.getMutable(engine.RootEntity).tags = newTags;
