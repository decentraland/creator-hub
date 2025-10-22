import type { IEngine, LastWriteWinElementSetComponentDefinition, TagsType } from '@dcl/ecs';

export function createTagsComponent(engine: IEngine) {
  const DEFAULT_TAGS = ['Tag Group 1', 'Tag Group 2', 'Tag Group 3', 'Tag Group 4'];

  const Tags = engine.getComponentOrNull(
    'core-schema::Tags',
  ) as LastWriteWinElementSetComponentDefinition<TagsType> | null;

  if (Tags) {
    const sceneTags = Tags.getMutableOrNull(engine.RootEntity);
    if (!sceneTags) {
      Tags.createOrReplace(engine.RootEntity, { tags: DEFAULT_TAGS });
      engine.update(1);
    }
  }
}
