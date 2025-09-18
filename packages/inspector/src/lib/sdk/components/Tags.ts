import { type Entity, type IEngine, Schemas, Tags } from '@dcl/ecs';

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
});

//TODO: validate no repeat names :)
export function createTag(engine: IEngine, tagName: string) {
  console.log('ALE: createTag called', tagName);
  const currentTags = Tags.getOrNull(engine.RootEntity);
  Tags.getMutable(engine.RootEntity).tags = [...(currentTags?.tags ?? []), tagName];
  engine.update(1);
}

//TODO: validate that is not a engine tag
export function removeTag(engine: IEngine, name: string) {
  console.log('ALE: removeTag called', name);

  const entitiesWithTags = engine.getEntitiesWith(Tags);
  for (const [entity] of entitiesWithTags) {
    const currentTags = Tags.getMutable(entity).tags;
    const newTags = currentTags.filter(tag => tag !== name);
    Tags.getMutable(entity).tags = newTags;
  }
  engine.update(1);
}

export const renameTag = (engine: IEngine, tag: string, newName: string) => {
  console.log('ALE: renameTag called', tag, newName);
  const entitiesWithTags = engine.getEntitiesWith(Tags);
  for (const [entity, component] of entitiesWithTags) {
    const newTags = component.tags.map($ => ($ === tag ? newName : $));
    Tags.getMutable(entity).tags = newTags;
  }
  engine.update(1);
};

export const getEntitiesWithTag = (engine: IEngine, tagName: string) => {
  console.log('ALE: getEntitiesWithTag called', tagName);
  const entities: Entity[] = [];
  for (const [entity, component] of engine.getEntitiesWith(Tags)) {
    if (entity !== engine.RootEntity && component.tags.some(tag => tag === tagName)) {
      entities.push(entity);
    }
  }
  return entities;
};
