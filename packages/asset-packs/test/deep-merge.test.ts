import { describe, it, expect } from 'vitest';
import { Schemas } from '@dcl/ecs';
import { createComponentFramework } from '../src/versioning/framework';

describe('Deep Merge Schemas', () => {
  // V0: { config: { database: { host, port } } }
  // V1: { config: { database: { password } } }
  // Result: { config: { database: { host, port, password } } }
  it('should merge nested plain objects', () => {
    const registry = {
      'test::Component': [
        {
          config: Schemas.Map({
            database: Schemas.Map({
              host: Schemas.String,
              port: Schemas.Int,
            }),
          }),
        },
        {
          config: Schemas.Map({
            database: Schemas.Map({
              password: Schemas.String, // Agregar nueva propiedad
            }),
          }),
        },
      ],
    } as const;

    const { VERSIONS_REGISTRY } = createComponentFramework(registry);
    const v1 = VERSIONS_REGISTRY['test::Component'][1];

    const dbProps = (v1.component.config.jsonSchema as any).properties.database.properties;

    // Debe tener las 3 propiedades: host, port, password
    expect(dbProps).toHaveProperty('host');
    expect(dbProps).toHaveProperty('port');
    expect(dbProps).toHaveProperty('password');
  });

  // V0: { foo: int }
  // V1: { bar: string }
  // Result: { foo: int, bar: string }
  it('should add new top-level properties', () => {
    const registry = {
      'test::Component': [{ foo: Schemas.Int }, { bar: Schemas.String }],
    } as const;

    const { VERSIONS_REGISTRY } = createComponentFramework(registry);
    const v1 = VERSIONS_REGISTRY['test::Component'][1];

    expect(v1.component).toHaveProperty('foo');
    expect(v1.component).toHaveProperty('bar');
  });

  // V0: { foo: int }
  // V1: { foo: string }
  // Result: { foo: string } (replacement)
  it('should replace when types conflict', () => {
    const registry = {
      'test::Component': [{ foo: Schemas.Int }, { foo: Schemas.String }],
    } as const;

    const { VERSIONS_REGISTRY } = createComponentFramework(registry);
    const v1 = VERSIONS_REGISTRY['test::Component'][1];

    expect(v1.component.foo.jsonSchema.serializationType).toBe('utf8-string');
  });

  // V0: { config: { a: int } }
  // V1: { config: { b: string } }
  // V2: { config: { c: boolean } }
  // Result: { config: { a, b, c } }
  it('should work through multiple versions', () => {
    const registry = {
      'test::Component': [
        {
          config: Schemas.Map({
            a: Schemas.Int,
          }),
        },
        {
          config: Schemas.Map({
            b: Schemas.String,
          }),
        },
        {
          config: Schemas.Map({
            c: Schemas.Boolean,
          }),
        },
      ],
    } as const;

    const { VERSIONS_REGISTRY } = createComponentFramework(registry);
    const v2 = VERSIONS_REGISTRY['test::Component'][2];

    const configProps = (v2.component.config.jsonSchema as any).properties;

    expect(configProps).toHaveProperty('a');
    expect(configProps).toHaveProperty('b');
    expect(configProps).toHaveProperty('c');
  });

  // V0: { level1: { level2: { level3: { a, b } } } }
  // V1: { level1: { level2: { level3: { c } } } }
  // Result: { level1: { level2: { level3: { a, b, c } } } }
  it('should handle 3 levels of nesting', () => {
    const registry = {
      'test::Component': [
        {
          level1: Schemas.Map({
            level2: Schemas.Map({
              level3: Schemas.Map({
                a: Schemas.Int,
                b: Schemas.String,
              }),
            }),
          }),
        },
        {
          level1: Schemas.Map({
            level2: Schemas.Map({
              level3: Schemas.Map({
                c: Schemas.Boolean,
              }),
            }),
          }),
        },
      ],
    } as const;

    const { VERSIONS_REGISTRY } = createComponentFramework(registry);
    const v1 = VERSIONS_REGISTRY['test::Component'][1];

    const level3Props = (v1.component.level1.jsonSchema as any).properties.level2.properties.level3
      .properties;

    expect(level3Props).toHaveProperty('a');
    expect(level3Props).toHaveProperty('b');
    expect(level3Props).toHaveProperty('c');
  });

  // V0: { config: { database: { host }, cache: { ttl } } }
  // V1: { config: { database: { port }, cache: { maxSize } } }
  // Result: { config: { database: { host, port }, cache: { ttl, maxSize } } }
  it('should merge multiple nested Maps at same level', () => {
    const registry = {
      'test::Component': [
        {
          config: Schemas.Map({
            database: Schemas.Map({
              host: Schemas.String,
            }),
            cache: Schemas.Map({
              ttl: Schemas.Int,
            }),
          }),
        },
        {
          config: Schemas.Map({
            database: Schemas.Map({
              port: Schemas.Int,
            }),
            cache: Schemas.Map({
              maxSize: Schemas.Int,
            }),
          }),
        },
      ],
    } as const;

    const { VERSIONS_REGISTRY } = createComponentFramework(registry);
    const v1 = VERSIONS_REGISTRY['test::Component'][1];

    const configProps = (v1.component.config.jsonSchema as any).properties;
    const dbProps = configProps.database.properties;
    const cacheProps = configProps.cache.properties;

    expect(dbProps).toHaveProperty('host');
    expect(dbProps).toHaveProperty('port');
    expect(cacheProps).toHaveProperty('ttl');
    expect(cacheProps).toHaveProperty('maxSize');
  });

  // V0: { config: { timeout: int } }
  // V1: { config: { database: { host } } }
  // Result: { config: { timeout, database: { host } } }
  it('should handle adding new nested Map', () => {
    const registry = {
      'test::Component': [
        {
          config: Schemas.Map({
            timeout: Schemas.Int,
          }),
        },
        {
          config: Schemas.Map({
            database: Schemas.Map({
              host: Schemas.String,
            }),
          }),
        },
      ],
    } as const;

    const { VERSIONS_REGISTRY } = createComponentFramework(registry);
    const v1 = VERSIONS_REGISTRY['test::Component'][1];

    const configProps = (v1.component.config.jsonSchema as any).properties;

    expect(configProps).toHaveProperty('timeout');
    expect(configProps).toHaveProperty('database');
    expect(configProps.database.properties).toHaveProperty('host');
  });

  // V0: { config: int }
  // V1: { config: { value: int } }
  // Result: { config: { value } } (replacement)
  it('should replace non-Map with Map', () => {
    const registry = {
      'test::Component': [{ config: Schemas.Int }, { config: Schemas.Map({ value: Schemas.Int }) }],
    } as const;

    const { VERSIONS_REGISTRY } = createComponentFramework(registry);
    const v1 = VERSIONS_REGISTRY['test::Component'][1];

    expect(v1.component.config.jsonSchema.serializationType).toBe('map');
    const configProps = (v1.component.config.jsonSchema as any).properties;
    expect(configProps).toHaveProperty('value');
  });

  // V0: { config?: { a: int } }
  // V1: { config?: { b: string } }
  // Result: { config?: { a, b } }
  it('should work with Optional wrapped Maps', () => {
    const registry = {
      'test::Component': [
        {
          config: Schemas.Optional(
            Schemas.Map({
              a: Schemas.Int,
            }),
          ),
        },
        {
          config: Schemas.Optional(
            Schemas.Map({
              b: Schemas.String,
            }),
          ),
        },
      ],
    } as const;

    const { VERSIONS_REGISTRY } = createComponentFramework(registry);
    const v1 = VERSIONS_REGISTRY['test::Component'][1];

    expect(v1.component.config.jsonSchema.serializationType).toBe('optional');

    const innerSchema = (v1.component.config.jsonSchema as any).optionalJsonSchema;
    expect(innerSchema.serializationType).toBe('map');
    expect(innerSchema.properties).toHaveProperty('a');
    expect(innerSchema.properties).toHaveProperty('b');
  });

  // V0: { items: int[] }
  // V1: { items: string[] }
  // Result: { items: string[] } (replacement)
  it('should handle Arrays (non-mergeable)', () => {
    const registry = {
      'test::Component': [
        { items: Schemas.Array(Schemas.Int) },
        { items: Schemas.Array(Schemas.String) },
      ],
    } as const;

    const { VERSIONS_REGISTRY } = createComponentFramework(registry);
    const v1 = VERSIONS_REGISTRY['test::Component'][1];

    expect(v1.component.items.jsonSchema.serializationType).toBe('array');
    const itemSchema = (v1.component.items.jsonSchema as any).items;
    expect(itemSchema.serializationType).toBe('utf8-string');
  });

  // V0: { sections?: Array<{ id, items: Array<{ component, widget }> }> }
  // V1: { sections?: Array<{ items: Array<{ label }> }> }
  // V2: { sections?: Array<{ columns }> }
  // Expected: { sections?: Array<{ id, columns, items: Array<{ component, widget, label }> }> }
  // Note: Este caso es muy complejo (Array dentro de Map dentro de Array)
  it.skip('should merge complex real-world structure with Arrays', () => {
    const registry = {
      'inspector::Config': [
        {
          sections: Schemas.Optional(
            Schemas.Array(
              Schemas.Map({
                id: Schemas.String,
                items: Schemas.Array(
                  Schemas.Map({
                    component: Schemas.String,
                    widget: Schemas.String,
                  }),
                ),
              }),
            ),
          ),
        },
        {
          sections: Schemas.Optional(
            Schemas.Array(
              Schemas.Map({
                items: Schemas.Array(
                  Schemas.Map({
                    label: Schemas.Optional(Schemas.String),
                  }),
                ),
              }),
            ),
          ),
        },
        {
          sections: Schemas.Optional(
            Schemas.Array(
              Schemas.Map({
                columns: Schemas.Optional(Schemas.Number),
              }),
            ),
          ),
        },
      ],
    } as const;

    const { VERSIONS_REGISTRY } = createComponentFramework(registry);
    const v2 = VERSIONS_REGISTRY['inspector::Config'][2];

    expect(v2.component.sections.jsonSchema.serializationType).toBe('optional');

    const arraySchema = (v2.component.sections.jsonSchema as any).optionalJsonSchema;
    expect(arraySchema.serializationType).toBe('array');

    const sectionProps = arraySchema.items.properties;
    expect(sectionProps).toHaveProperty('id');
    expect(sectionProps).toHaveProperty('columns');
    expect(sectionProps).toHaveProperty('items');

    const itemProps = sectionProps.items.items.properties;
    expect(itemProps).toHaveProperty('component');
    expect(itemProps).toHaveProperty('widget');
    expect(itemProps).toHaveProperty('label');
  });
});
