import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const devConfig = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../renderer/src/config/env/dev.json'),
    'utf8',
  ),
) as { ENS_SUBGRAPH: string };

/** True when the `.zone` ENS subgraph (the World name list's dependency) answers. */
export async function ensSubgraphAvailable(): Promise<boolean> {
  try {
    const response = await fetch(devConfig.ENS_SUBGRAPH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ _meta { block { number } } }' }),
    });
    if (!response.ok) return false;
    const body = await response.json();
    return !('error' in body) && !('errors' in body);
  } catch {
    return false;
  }
}
