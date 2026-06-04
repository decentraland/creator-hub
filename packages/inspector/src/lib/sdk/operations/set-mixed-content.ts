import type { Entity, IEngine } from '@dcl/ecs';
import type { UISegment } from '@dcl/asset-packs';
import { SegmentKind } from '@dcl/asset-packs';

import { assertFieldPath, assertIdentifier } from './validators';
import { getBindingsRows, writeBindingsRows } from './ui-bindings-store';

export function setMixedContent(engine: IEngine) {
  return function setMixedContent(entity: Entity, field: string, segments: UISegment[]): void {
    assertFieldPath(field);
    for (const seg of segments) {
      if (seg.kind === SegmentKind.BINDING) {
        assertIdentifier(seg.value, 'variable name');
      }
    }
    const rows = getBindingsRows(engine, entity);
    const without = rows.filter(b => b.field !== field);
    writeBindingsRows(engine, entity, [...without, { field, variable: '', segments }]);
  };
}

export default setMixedContent;
