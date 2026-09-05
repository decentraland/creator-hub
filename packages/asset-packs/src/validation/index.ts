import type { AssetComposite } from '../types';
import type { ValidationError } from './rules';
import { rules } from './rules';

export type { ValidationError } from './rules';

export function validateComposite(
  components: AssetComposite['components'],
  assetName: string,
): ValidationError[] {
  return rules.flatMap(rule => rule.validate(components, assetName));
}
