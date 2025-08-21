import type { IEngine, Entity } from '@dcl/ecs';
import { NetworkEntity as NetworkEntityEngine } from '@dcl/ecs';
import type { EnumEntity } from './enum-entity';
import { createEnumEntityId, INSPECTOR_ENUM_ENTITY_ID_START } from './enum-entity';

describe('createEnumEntityId', () => {
  it('returns functions to get and increment enum entity id', () => {
    const engineMock: IEngine = {
      getComponent: vi.fn(),
      getEntitiesWith: vi.fn(),
    } as any as IEngine;

    const mockNetworkEntity = (entityId: number) => ({
      entityId,
    });

    const networkEntityComponent = mockNetworkEntity(1111);
    (engineMock.getComponent as vi.Mock).mockReturnValue(networkEntityComponent);

    const entitiesWithMock = new Map([
      [1, { entityId: 2222 }],
      [2, { entityId: INSPECTOR_ENUM_ENTITY_ID_START }],
    ]);

    (engineMock.getEntitiesWith as vi.Mock).mockImplementation(
      (component: typeof NetworkEntityEngine) => {
        const result: Entity[] = [];
        entitiesWithMock.forEach((_, key) => {
          if (component === NetworkEntityEngine) {
            result.push(key as Entity);
          }
        });
        return result;
      },
    );

    const enumEntity: EnumEntity = createEnumEntityId(engineMock);

    expect(enumEntity.getNextEnumEntityId()).toBe(INSPECTOR_ENUM_ENTITY_ID_START + 1);
  });
});
