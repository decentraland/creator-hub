/**
 * Persistence for the MobileHUD: reads/writes the scene's `src/mobile-hud.ts`
 * lazily (only when the config leaves defaults) and cleans it up — plus the
 * `src/index.ts` wiring — when it returns to defaults. Code is the source of
 * truth; this store is a thin external store the panel/canvas subscribe to.
 *
 * @module
 */
import { useSyncExternalStore } from 'react';

import { getStorage } from '../../../lib/data-layer/client/storage';
import { getCodeParser } from '../../../lib/logic/code-parser';
import { markOwnWrite } from '../../../lib/logic/own-writes';
import type { Edit } from '../code/emit-adapter';
import { applyEdits } from '../code/emit-adapter';
import { readFromDisk, SCENE_ENTRY, writeToDisk } from '../code/store-core';
import type { MobileHudConfig } from './mobile-hud-config';
import { defaultMobileHudConfig, isDefaultMobileHudConfig } from './mobile-hud-config';
import {
  generateMobileHudModule,
  MOBILE_HUD_MODULE,
  parseMobileHudConfig,
  unwireMobileHudEdits,
  wireMobileHudEdits,
} from './mobile-hud-emit';

let current: MobileHudConfig = defaultMobileHudConfig();
const listeners = new Set<() => void>();

function publish(config: MobileHudConfig): void {
  current = config;
  for (const listener of listeners) listener();
}

export function getMobileHudConfig(): MobileHudConfig {
  return current;
}

export function useMobileHudConfig(): MobileHudConfig {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, getMobileHudConfig);
}

async function parseProgram(path: string, source: string): Promise<unknown | null> {
  const parser = getCodeParser();
  if (!parser) return null;
  try {
    const { program, errors } = await parser.parse(path, source);
    return errors && errors.length > 0 ? null : program;
  } catch {
    return null;
  }
}

/** Read the scene's current MobileHUD config (defaults when the module is absent). */
export async function loadMobileHudConfig(): Promise<MobileHudConfig> {
  const source = await readFromDisk(MOBILE_HUD_MODULE);
  const program = source ? await parseProgram(MOBILE_HUD_MODULE, source) : null;
  publish(program ? parseMobileHudConfig(program, source) : defaultMobileHudConfig());
  return current;
}

async function editSceneEntry(build: (program: { body?: any[] }, source: string) => Edit[]) {
  const source = await readFromDisk(SCENE_ENTRY);
  if (!source) return;
  const program = await parseProgram(SCENE_ENTRY, source);
  if (!program) return;
  const next = applyEdits(source, build(program as { body?: any[] }, source));
  if (next !== source) await writeToDisk(SCENE_ENTRY, next);
}

/** Persist the config, writing/cleaning `src/mobile-hud.ts` + its wiring lazily. */
export async function writeMobileHudConfig(config: MobileHudConfig): Promise<void> {
  publish(config);
  if (isDefaultMobileHudConfig(config)) {
    await removeMobileHud();
    return;
  }
  await writeToDisk(MOBILE_HUD_MODULE, generateMobileHudModule(config));
  await editSceneEntry(wireMobileHudEdits);
}

export async function removeMobileHud(): Promise<void> {
  await editSceneEntry(unwireMobileHudEdits);
  const storage = getStorage();
  if (!storage) return;
  try {
    if (await storage.exists(MOBILE_HUD_MODULE)) {
      markOwnWrite(MOBILE_HUD_MODULE);
      await storage.delete(MOBILE_HUD_MODULE);
    }
  } catch {
    return;
  }
}
