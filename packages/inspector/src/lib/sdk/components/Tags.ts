import { type IEngine, Schemas } from '@dcl/ecs';

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

const TAG_COMPONENT_NAME = 'core::Tags';

const DEFAULT_TAGS = [
  { name: 'Tag Group 1', type: TagType.Engine },
  { name: 'Tag Group 2', type: TagType.Engine },
  { name: 'Tag Group 3', type: TagType.Engine },
  { name: 'Tag Group 4', type: TagType.Engine },
];

export function defineTagsComponents(engine: IEngine) {
  const Tags = engine.defineComponent(TAG_COMPONENT_NAME, { tags: Schemas.Array(Tag) });
  Tags.create(engine.RootEntity, { tags: DEFAULT_TAGS });
  return Tags;
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
