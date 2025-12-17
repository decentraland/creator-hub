import type { TagsType } from '@dcl/ecs';
import type { TagsInput } from './types';

// SDK → UI
export function fromTags(value: TagsType): TagsInput {
  return {
    tags: value.tags || [],
  };
}

// UI → SDK
export function toTags(input: TagsInput): TagsType {
  return {
    tags: input.tags,
  };
}
