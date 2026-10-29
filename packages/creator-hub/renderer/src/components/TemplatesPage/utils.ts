import type { Template } from '/@/modules/templates';

import { SortBy } from './types';

export function sortTemplatesBy(templates: Template[], type: SortBy): Template[] {
  switch (type) {
    case SortBy.DEFAULT:
      return templates.toSorted((a, b) => a.title.localeCompare(b.title));
    case SortBy.NEWEST:
      return templates.toSorted((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }
}
