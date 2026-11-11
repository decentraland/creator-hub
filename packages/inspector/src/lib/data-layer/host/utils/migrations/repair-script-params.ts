import type { IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import { ComponentName, type Script } from '@dcl/asset-packs';

import type { FileSystemInterface } from '../../../types';
import {
  hasMalformedParams,
  parseLayout,
  repairMalformedParams,
} from '../../../../sdk/script-params';

type ScriptItem = Script['value'][number];

/**
 * Rebuilds Script params whose object or list value has the wrong shape (Creator Hub 0.52 saved
 * the text typed into them, #1765) from each script's source. Returns whether anything changed.
 */
export async function repairScriptParams(
  engine: IEngine,
  fs: FileSystemInterface,
): Promise<boolean> {
  const ScriptComponent = engine.getComponentOrNull(
    ComponentName.SCRIPT,
  ) as LastWriteWinElementSetComponentDefinition<Script> | null;
  if (!ScriptComponent) return false;

  let changed = false;
  for (const [entity, value] of engine.getEntitiesWith(ScriptComponent)) {
    const scripts = await Promise.all(value.value.map(script => repairScript(script, fs)));
    if (scripts.every((script, index) => script === value.value[index])) continue;
    ScriptComponent.createOrReplace(entity, { value: scripts });
    changed = true;
  }
  return changed;
}

async function repairScript(script: ScriptItem, fs: FileSystemInterface): Promise<ScriptItem> {
  const stored = parseLayout(script.layout);
  if (!stored || !hasMalformedParams(stored)) return script;
  try {
    if (!(await fs.existFile(script.path))) return script;
    const content = new TextDecoder().decode(await fs.readFile(script.path));
    const layout = repairMalformedParams(stored, content);
    return layout ? { ...script, layout: JSON.stringify(layout) } : script;
  } catch (error) {
    console.warn(`Failed to repair the params of '${script.path}':`, error);
    return script;
  }
}
