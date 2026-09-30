import type { Entity } from '@dcl/ecs';

// Test double for the SDK's `~sdk/script-utils` virtual module (normally provided by the scene
// bundle). It mirrors the real registry-lookup semantics of `callScriptMethod` so a test can wire
// the full trigger -> action -> call_script_method -> instance chain against real script instances.

const registry = new Map<string, { instance: Record<string, unknown> }>();

export function __register(entity: Entity, path: string, instance: Record<string, unknown>): void {
  registry.set(`${entity}:${path}`, { instance });
}

export function __clear(): void {
  registry.clear();
}

export function getScriptInstance(entity: Entity, scriptPath: string): unknown {
  return registry.get(`${entity}:${scriptPath}`)?.instance ?? null;
}

export function callScriptMethod(
  entity: Entity,
  scriptPath: string,
  methodName: string,
  ...args: unknown[]
): unknown {
  const instance = registry.get(`${entity}:${scriptPath}`)?.instance as
    | Record<string, (...a: unknown[]) => unknown>
    | undefined;
  if (instance && typeof instance[methodName] === 'function') {
    return instance[methodName](...args);
  }
  return undefined;
}

export function getScriptInstancesByPath(): Array<{ entity: Entity; instance: unknown }> {
  return [];
}

export function getAllScriptInstances(): Array<{ path: string; instance: unknown }> {
  return [];
}
