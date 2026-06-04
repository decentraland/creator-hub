import type { Entity, IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { UIBindings, UISegment } from '@dcl/asset-packs';
import { ComponentName, SegmentKind } from '@dcl/asset-packs';

import { assertFieldPath, assertIdentifier } from './validators';

export function setMixedContent(engine: IEngine) {
  return function setMixedContent(entity: Entity, field: string, segments: UISegment[]): void {
    assertFieldPath(field);
    for (const seg of segments) {
      if (seg.kind === SegmentKind.BINDING) {
        assertIdentifier(seg.value, 'variable name');
      }
    }
    const Bindings = engine.getComponent(
      ComponentName.UI_BINDINGS,
    ) as LastWriteWinElementSetComponentDefinition<UIBindings>;
    const current = Bindings.getOrNull(entity);
    const rows = current?.value ?? [];
    const without = rows.filter(b => b.field !== field);
    Bindings.createOrReplace(entity, {
      value: [...without, { field, variable: '', segments }] as UIBindings['value'],
    });
  };
}

export default setMixedContent;
