import fs from 'fs';
import path from 'path';

import { entityValidators } from './entity-validators';

const ENTITY_INSPECTOR_DIR = path.resolve(__dirname, '../../../components/EntityInspector');

function findUtilsWithEntityValidator(dir: string): string[] {
  const results: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findUtilsWithEntityValidator(fullPath));
    } else if (entry.name === 'utils.ts') {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (/export\s+const\s+entityValidator\b/.test(content)) {
        results.push(path.relative(ENTITY_INSPECTOR_DIR, fullPath));
      }
    }
  }

  return results;
}

describe('entity-validators registry', () => {
  it('should register all entityValidator exports from EntityInspector components', () => {
    const utilsWithValidators = findUtilsWithEntityValidator(ENTITY_INSPECTOR_DIR);

    expect(utilsWithValidators.length).toBeGreaterThan(0);
    expect(entityValidators).toHaveLength(utilsWithValidators.length);
  });
});
