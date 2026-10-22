import { vi } from 'vitest';
import type * as Ecs from '@dcl/ecs';

type TriggerHandler = (event: { trigger?: { entity: number } }) => void;

export const triggers = {
  enter: [] as TriggerHandler[],
  stay: [] as TriggerHandler[],
  exit: [] as TriggerHandler[],
};

/** Stands in for `@dcl/sdk/ecs`: the real `@dcl/ecs`, every component bound to its helpers, and trigger-area events fired by the test. */
export async function fakeSdkEcs() {
  const ecs = await vi.importActual<typeof Ecs>('@dcl/ecs');
  const withHelpers = Object.entries(ecs.components)
    .filter(([, define]) => typeof define === 'function')
    .map(([name, define]) => [name, (define as (engine: Ecs.IEngine) => unknown)(ecs.engine)]);
  return {
    ...ecs,
    ...(Object.fromEntries(withHelpers) as typeof ecs),
    triggerAreaEventsSystem: {
      onTriggerEnter: (_: unknown, fn: TriggerHandler) => triggers.enter.push(fn),
      onTriggerStay: (_: unknown, fn: TriggerHandler) => triggers.stay.push(fn),
      onTriggerExit: (_: unknown, fn: TriggerHandler) => triggers.exit.push(fn),
    },
  };
}

/**
 * The scene engine a smart-item script sees, with the asset-packs components defined, no
 * players and no trigger handlers left over from an earlier test.
 */
export async function loadScriptEngine() {
  triggers.enter.length = 0;
  triggers.stay.length = 0;
  triggers.exit.length = 0;
  const ecs = (await import('@dcl/sdk/ecs')) as unknown as typeof Ecs;
  const definitions = await import('../src/definitions');
  definitions.createComponents(ecs.engine);
  const { States } = definitions.getComponents(ecs.engine);
  for (const [player] of ecs.engine.getEntitiesWith(ecs.PlayerIdentityData)) {
    ecs.PlayerIdentityData.deleteFrom(player);
  }
  return { ...ecs, States };
}

export function fire(kind: keyof typeof triggers, entity: Ecs.Entity) {
  for (const fn of triggers[kind]) fn({ trigger: { entity } });
}

export type ScriptEngine = Awaited<ReturnType<typeof loadScriptEngine>>;
