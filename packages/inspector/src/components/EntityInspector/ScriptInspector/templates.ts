import { toPascalCase } from '../../../lib/utils/strings';

export function getScriptTemplateClass(scriptName: string): string {
  const className = toPascalCase(scriptName, 'Script') || 'Script';
  return `
import { engine, Entity } from '@dcl/sdk/ecs'

export class ${className} {
  constructor(public entity: Entity) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    // Script initialization
    console.log("${className} initialized for entity:", this.entity);
  }

  /**
   * Update function - called every frame
   * @param dt - Delta time since last frame (in seconds)
   */
  update(dt: number) {
    // Called every frame
  }
}
`;
}
