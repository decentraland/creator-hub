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
});
