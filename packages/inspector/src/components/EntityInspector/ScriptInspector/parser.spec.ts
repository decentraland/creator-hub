import { describe, it, expect } from 'vitest';

import { getScriptParams } from './parser';

function classScript(constructorParams: string, leadingComment = ''): string {
  return `
import { Entity } from '@dcl/sdk/ecs'

export class TestScript {
  ${leadingComment}
  constructor(
    public src: string,
    public entity: Entity,
    ${constructorParams}
  ) {}
}
`;
}

describe('getScriptParams', () => {
  describe('when parsing a slider param with min, max and step', () => {
    it('should return a slider param with the declared range and the default value', () => {
      const { params } = getScriptParams(classScript('public speed: Slider<0, 10, 0.5> = 1,'));
      expect(params.speed).toEqual({
        type: 'slider',
        value: 1,
        min: 0,
        max: 10,
        step: 0.5,
        optional: true,
      });
    });
  });

  describe('when parsing a slider param without a step argument', () => {
    it('should default the step to 1', () => {
      const { params } = getScriptParams(classScript('public volume: Slider<0, 100> = 50,'));
      expect(params.volume).toMatchObject({ type: 'slider', min: 0, max: 100, step: 1, value: 50 });
    });
  });

  describe('when parsing a slider param with negative bounds', () => {
    it('should parse the negative literals', () => {
      const { params } = getScriptParams(classScript('public tilt: Slider<-90, 90> = 0,'));
      expect(params.tilt).toMatchObject({ type: 'slider', min: -90, max: 90, value: 0 });
    });
  });

  describe('when a param has a negative default value', () => {
    it('should parse the negative slider default', () => {
      const { params } = getScriptParams(classScript('public depth: Slider<-100, -10, 10> = -50,'));
      expect(params.depth).toMatchObject({ type: 'slider', min: -100, max: -10, value: -50 });
    });

    it('should parse the negative number default', () => {
      const { params } = getScriptParams(classScript('public offset: number = -5,'));
      expect(params.offset).toMatchObject({ type: 'number', value: -5 });
    });
  });

  describe('when parsing a slider param without a default value', () => {
    it('should use the minimum as the value', () => {
      const { params } = getScriptParams(classScript('public speed: Slider<2, 10>,'));
      expect(params.speed).toMatchObject({ type: 'slider', value: 2, min: 2, max: 10 });
    });
  });

  describe('when the slider default value is out of range', () => {
    it('should clamp the value into the declared range', () => {
      const { params } = getScriptParams(classScript('public speed: Slider<0, 10> = 50,'));
      expect(params.speed).toMatchObject({ type: 'slider', value: 10 });
    });
  });

  describe('when the slider has no type arguments', () => {
    it('should fall back to a plain number param', () => {
      const { params } = getScriptParams(classScript('public speed: Slider = 3,'));
      expect(params.speed).toMatchObject({ type: 'number', value: 3 });
    });
  });

  describe('when the slider bounds are invalid', () => {
    it('should fall back to a plain number param if min >= max', () => {
      const { params } = getScriptParams(classScript('public speed: Slider<10, 0> = 3,'));
      expect(params.speed).toMatchObject({ type: 'number', value: 3 });
    });

    it('should fall back to a plain number param if step is not positive', () => {
      const { params } = getScriptParams(classScript('public speed: Slider<0, 10, 0> = 3,'));
      expect(params.speed).toMatchObject({ type: 'number', value: 3 });
    });
  });

  describe('when parsing a function-based script with a slider param', () => {
    it('should return a slider param', () => {
      const { params } = getScriptParams(`
export function start(src: string, entity: Entity, speed: Slider<0, 10> = 5) {}
`);
      expect(params.speed).toMatchObject({ type: 'slider', value: 5, min: 0, max: 10, step: 1 });
    });
  });

  describe('when a slider param has a @param tooltip', () => {
    it('should attach the tooltip to the slider param', () => {
      const { params } = getScriptParams(
        classScript(
          'public speed: Slider<0, 10> = 1,',
          `/**
   * @param speed - How fast it goes
   */`,
        ),
      );
      expect(params.speed).toMatchObject({ type: 'slider', tooltip: 'How fast it goes' });
    });
  });

  describe('when parsing a string-literal union param', () => {
    it('should return an enum with the literals as options and the default as the value', () => {
      const { params } = getScriptParams(classScript("public shape: 'box' | 'sphere' = 'sphere',"));
      expect(params.shape).toEqual({
        type: 'enum',
        value: 'sphere',
        options: ['box', 'sphere'],
        optional: true,
      });
    });

    it('should use the first option as the value when there is no default', () => {
      const { params } = getScriptParams(classScript("public shape: 'box' | 'sphere',"));
      expect(params.shape).toMatchObject({
        type: 'enum',
        value: 'box',
        options: ['box', 'sphere'],
      });
    });

    it('should treat an optional string-literal union as an enum', () => {
      const { params } = getScriptParams(
        classScript("public shape: 'box' | 'sphere' | undefined,"),
      );
      expect(params.shape).toMatchObject({ type: 'enum', options: ['box', 'sphere'] });
    });

    it('should NOT treat `string | undefined` as an enum', () => {
      const { params } = getScriptParams(classScript('public label: string | undefined,'));
      expect(params.label).toMatchObject({ type: 'string' });
    });
  });

  describe('when a class declares @event tags', () => {
    it('extracts the event names', () => {
      const { events } = getScriptParams(
        classScript(
          'public onlyMe: boolean = false,',
          `/**
   * @event enter
   * @event exit
   */`,
        ),
      );
      expect(events).toEqual(['enter', 'exit']);
    });

    it('is empty when there are no @event tags', () => {
      const { events } = getScriptParams(classScript('public speed: number = 1,'));
      expect(events).toEqual([]);
    });
  });

  describe('when parsing the other param types alongside a slider', () => {
    it('should keep parsing number, boolean, string and entity params', () => {
      const { params } = getScriptParams(
        classScript(`
    public amount: number = 7,
    public enabled: boolean = true,
    public title: string = 'hey',
    public target: Entity,
    public speed: Slider<0, 10> = 1,
`),
      );
      expect(params.amount).toMatchObject({ type: 'number', value: 7 });
      expect(params.enabled).toMatchObject({ type: 'boolean', value: true });
      expect(params.title).toMatchObject({ type: 'string', value: 'hey' });
      expect(params.target).toMatchObject({ type: 'entity' });
      expect(params.speed).toMatchObject({ type: 'slider', value: 1 });
    });
  });

  describe('when parsing a list param', () => {
    it('parses `string[]` as an empty array of strings', () => {
      const { params } = getScriptParams(classScript('public tags: string[],'));
      expect(params.tags).toMatchObject({
        type: 'array',
        value: [],
        item: { type: 'string' },
      });
    });

    it('parses the `Array<T>` form the same as `T[]`', () => {
      const { params } = getScriptParams(classScript('public tags: Array<number>,'));
      expect(params.tags).toMatchObject({ type: 'array', value: [], item: { type: 'number' } });
    });

    it('keeps an authored default array', () => {
      const { params } = getScriptParams(classScript("public tags: string[] = ['a', 'b'],"));
      expect(params.tags).toMatchObject({
        type: 'array',
        value: ['a', 'b'],
        item: { type: 'string' },
      });
    });

    it('parses a list of objects, including nested entity and action leaves', () => {
      const { params } = getScriptParams(
        classScript(
          'public items: Array<{ entity: Entity; onDo: ActionCallback; label: string }>,',
        ),
      );
      expect(params.items).toMatchObject({
        type: 'array',
        value: [],
        item: {
          type: 'object',
          fields: {
            entity: { type: 'entity' },
            onDo: { type: 'action' },
            label: { type: 'string' },
          },
        },
      });
    });
  });

  describe('when parsing a nested object param', () => {
    it('parses an inline object type into fields with type-derived defaults', () => {
      const { params } = getScriptParams(
        classScript('public coords: { x: number; y: number; z: number },'),
      );
      expect(params.coords).toMatchObject({
        type: 'object',
        value: { x: 0, y: 0, z: 0 },
        fields: {
          x: { type: 'number', value: 0 },
          y: { type: 'number', value: 0 },
          z: { type: 'number', value: 0 },
        },
      });
    });

    it('keeps an authored object default and does not clobber it with an empty string', () => {
      const { params } = getScriptParams(
        classScript(
          'public cfg: { enabled: boolean; count: number } = { enabled: true, count: 3 },',
        ),
      );
      expect(params.cfg).toMatchObject({
        type: 'object',
        value: { enabled: true, count: 3 },
        fields: { enabled: { type: 'boolean' }, count: { type: 'number' } },
      });
    });

    it('fills type-derived defaults for keys whose literal value is not statically evaluable', () => {
      // `b`'s default is an identifier the parser can't evaluate; it must fall back to the
      // type-derived default rather than leaving `b` undefined at runtime.
      const { params } = getScriptParams(
        classScript('public cfg: { a: number; b: number } = { a: 5, b: someConst },'),
      );
      expect(params.cfg).toMatchObject({ type: 'object', value: { a: 5, b: 0 } });
    });

    it('recurses into object-in-object', () => {
      const { params } = getScriptParams(
        classScript(
          'public group: { pos: { x: number }; on: boolean } = { pos: { x: 5 }, on: true },',
        ),
      );
      expect(params.group).toMatchObject({
        type: 'object',
        value: { pos: { x: 5 }, on: true },
        fields: {
          pos: { type: 'object', fields: { x: { type: 'number' } } },
          on: { type: 'boolean' },
        },
      });
    });
  });

  describe('when parsing a Color3 param', () => {
    it('should default to white when there is no default value', () => {
      const { params } = getScriptParams(classScript('public tint: Color3,'));
      expect(params.tint).toEqual({ type: 'color', value: { r: 1, g: 1, b: 1 }, optional: false });
    });

    it('should evaluate a Color3.create default', () => {
      const { params } = getScriptParams(
        classScript('public tint: Color3 = Color3.create(1, 0.5, 0),'),
      );
      expect(params.tint).toMatchObject({ type: 'color', value: { r: 1, g: 0.5, b: 0 } });
    });

    it('should evaluate a Color3.fromHexString default', () => {
      const { params } = getScriptParams(
        classScript("public tint: Color3 = Color3.fromHexString('#FF0000'),"),
      );
      expect(params.tint).toMatchObject({ type: 'color', value: { r: 1, g: 0, b: 0 } });
    });

    it('should evaluate a named colour default', () => {
      const { params } = getScriptParams(classScript('public tint: Color3 = Color3.Black(),'));
      expect(params.tint).toMatchObject({ type: 'color', value: { r: 0, g: 0, b: 0 } });
    });

    it('should take an object literal default', () => {
      const { params } = getScriptParams(
        classScript('public tint: Color3 = { r: 0.2, g: 0.4, b: 0.6 },'),
      );
      expect(params.tint).toMatchObject({ type: 'color', value: { r: 0.2, g: 0.4, b: 0.6 } });
    });

    it('should recognise a namespace type such as Color3.Mutable', () => {
      const { params } = getScriptParams(classScript('public tint: Color3.Mutable,'));
      expect(params.tint).toMatchObject({ type: 'color' });
    });

    it('should fall back to white when the default is not statically evaluable', () => {
      const { params } = getScriptParams(classScript('public tint: Color3 = makeColor(),'));
      expect(params.tint).toMatchObject({ type: 'color', value: { r: 1, g: 1, b: 1 } });
    });

    it('should not run Color3 helpers outside the allowed factories', () => {
      const { params } = getScriptParams(classScript('public tint: Color3 = Color3.Random(),'));
      expect(params.tint).toMatchObject({ type: 'color', value: { r: 1, g: 1, b: 1 } });
    });

    it('should drop the alpha of a Color4 default given to a Color3', () => {
      const { params } = getScriptParams(
        classScript('public tint: Color3 = Color4.create(1, 0, 0, 0.5),'),
      );
      expect(params.tint).toMatchObject({ value: { r: 1, g: 0, b: 0 } });
      expect(params.tint.value).not.toHaveProperty('a');
    });
  });

  describe('when parsing a Color4 param', () => {
    it('should default to opaque white', () => {
      const { params } = getScriptParams(classScript('public tint: Color4,'));
      expect(params.tint).toMatchObject({ type: 'color', value: { r: 1, g: 1, b: 1, a: 1 } });
    });

    it('should keep the alpha of its default', () => {
      const { params } = getScriptParams(
        classScript('public tint: Color4 = Color4.create(0, 0, 1, 0.25),'),
      );
      expect(params.tint).toMatchObject({ value: { r: 0, g: 0, b: 1, a: 0.25 } });
    });
  });

  describe('when an action method takes a colour', () => {
    it('should parse the action param as a colour', () => {
      const { actions } = getScriptParams(`
import { Entity } from '@dcl/sdk/ecs'
export class TestScript {
  constructor(public src: string, public entity: Entity) {}
  /** @action */
  paint(color: Color3 = Color3.Red()) {}
}
`);
      expect(actions[0].params.color).toMatchObject({ type: 'color', value: { r: 1, g: 0, b: 0 } });
    });
  });
});

describe('when a script tags its params with editor hints', () => {
  it('should narrow an entity to the components named by @components', () => {
    const { params } = getScriptParams(
      classScript(`
        /** @components asset-packs::Actions, asset-packs::VideoScreen */
        public target: Entity,`),
    );
    expect(params.target).toMatchObject({
      type: 'entity',
      components: ['asset-packs::Actions', 'asset-packs::VideoScreen'],
    });
  });

  it('should tie a string in a list of objects to its sibling entity with @actionsOf', () => {
    const { params } = getScriptParams(
      classScript(`
        public smartItems: Array<{
          /** @components asset-packs::Actions */
          entity: Entity;
          /** @actionsOf entity */
          defaultAction: string;
        }> = [],`),
    );
    expect(params.smartItems).toMatchObject({
      type: 'array',
      item: {
        type: 'object',
        fields: {
          entity: { type: 'entity', components: ['asset-packs::Actions'] },
          defaultAction: { type: 'string', actionsOf: 'entity' },
        },
      },
    });
  });

  it('should apply @format wallet to each element of a string list', () => {
    const { params } = getScriptParams(
      classScript(`
        public users: {
          /** @format wallet */
          adminAllowList: string[];
        } = { adminAllowList: [] },`),
    );
    expect(params.users).toMatchObject({
      fields: { adminAllowList: { type: 'array', item: { type: 'string', format: 'wallet' } } },
    });
  });

  it('should mark a string tagged @format image, audio, video or model as a file path', () => {
    const { params } = getScriptParams(
      classScript(`
        /** @format image */
        public skyboxTexture: string = '',
        /** @format audio */
        public clip: string = '',
        /** @format video */
        public movie: string = '',
        /** @format model */
        public prop: string = '',`),
    );
    expect(params.skyboxTexture).toMatchObject({ type: 'string', value: '', format: 'image' });
    expect(params.clip).toMatchObject({ format: 'audio' });
    expect(params.movie).toMatchObject({ format: 'video' });
    expect(params.prop).toMatchObject({ format: 'model' });
  });

  it('should ignore an unknown @format', () => {
    const { params } = getScriptParams(
      classScript(`
        /** @format texture */
        public skyboxTexture: string = '',`),
    );
    expect(params.skyboxTexture).not.toHaveProperty('format');
  });

  it('should tie a param to the sibling named by @enabledIf', () => {
    const { params } = getScriptParams(
      classScript(`
        public fixSunPosition: boolean = false,
        /** @enabledIf fixSunPosition */
        public sunHeight: number = 45,
        /** @enabledIf !fixSunPosition */
        public followTime: boolean = true,`),
    );
    expect(params.sunHeight).toMatchObject({ type: 'number', enabledIf: 'fixSunPosition' });
    expect(params.followTime).toMatchObject({ type: 'boolean', enabledIf: '!fixSunPosition' });
    expect(params.fixSunPosition).not.toHaveProperty('enabledIf');
  });

  it('should lock a whole list with @enabledIf rather than each element', () => {
    const { params } = getScriptParams(
      classScript(`
        public useList: boolean = false,
        /** @enabledIf useList */
        public names: string[] = [],`),
    );
    expect(params.names).toMatchObject({ type: 'array', enabledIf: 'useList' });
    expect(params.names.type === 'array' && params.names.item).not.toHaveProperty('enabledIf');
  });

  it('should leave untagged params as they were', () => {
    const { params } = getScriptParams(classScript('public target: Entity, public label: string,'));
    expect(params.target).not.toHaveProperty('components');
    expect(params.label).not.toHaveProperty('actionsOf');
    expect(params.label).not.toHaveProperty('format');
    expect(params.label).not.toHaveProperty('enabledIf');
  });
});
