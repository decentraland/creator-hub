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

export function getSceneTags(engine: IEngine) {
  return getTagsForEntity(engine, engine.RootEntity);
}

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
  const currentTags = Tags.getOrNull(engine.RootEntity)?.tags ?? [];
  if (Tags) {
    Tags.getMutable(engine.RootEntity).tags = [...currentTags, { name, type: TagType.Custom }];
    engine.update(1);
  }
}
